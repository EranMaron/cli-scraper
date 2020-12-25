const fs = require("fs");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const sizeOf = require("image-size");
const sharp = require("sharp");

//CONSTS
const url = process.argv[2].replace(/\/\/|.+\/\//, "");
const folderName = process.argv[3];
const images = [];

//FETCH DATA FROM GIVEN URL
const fetchHTML = async () => {
  const response = await fetch(`https://${url}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  } else {
    return await response.text();
  }
};

//PARSING THE HTML & SCRAPING IMAGES URL'S
const parsingHTML = async html => {
  const Cheerio = cheerio.load(html);
  const imgs = Cheerio("img").each((index, img) => {
    const imgSrc = Cheerio(img).attr("src");
    if (imgSrc.indexOf("https://") > -1 || imgSrc.indexOf("http://") > -1) {
      images[index] = { imgUrl: imgSrc };
    } else if (imgSrc.indexOf("//") > -1) {
      images[index] = { imgUrl: `https:${imgSrc}` };
    } else if (imgSrc.indexOf("/") > -1) {
      images[index] = { imgUrl: `https://${url}${imgSrc}` };
    }
  });
  return await Promise.resolve("Finished to parse HTML...");
};

//SAVE IMAGES TO GIVEN FOLDER AND SAVE AS BASE64 BUFFER
const saveAndConvertImages = async () => {
  return Promise.all(
    images.map(async (obj, index) => {
      const response = await fetch(obj.imgUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      } else {
        const buffer = await response.buffer();
        fs.writeFileSync(`${process.cwd()}/${folderName}/${index}.jpg`, buffer);
        obj["fileName"] = index;
        const { width, height, type } = sizeOf(buffer);
        if (width > "120") {
          let resizedBuffer = await resizeImageBuffer(buffer);
          obj["base64"] = `data:image/png;base64,${resizedBuffer}`;
        } else {
          const base64 = await buffer.toString("base64");
          obj["base64"] = `data:image/png;base64,${base64}`;
        }

        obj["info"] = {
          width,
          height,
          type,
        };
        return Promise.resolve(buffer);
      }
    }),
  );
};

//RESIZE IMAGE IF WIDTH > 120
const resizeImageBuffer = async buffer => {
  let resizedBuffer = sharp(buffer)
    .resize(120)
    .toBuffer()
    .then(data => (resizedBuffer = data.toString("base64")));
  return resizedBuffer;
};

//CREATE HTML FILE
const createHTMLFile = () => {
  const prefixHTML = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>intango</title>
    <style>
    * {
      margin: 0;
      padding: 0;
    }
    body {
      color: #111;
      background-color: #eee;
    } 
    .grid-container {
      display: flex;
      flex-direction: column;
      width: 60vw;
      margin: 20px auto;
      padding: 30px;
      border: 1px solid #111;
    }
    .element-container {
      display: flex;
      justify-content: space-between;
      padding: 30px;
    }
    .image-box {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 150px;
    }
    .details-box {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-end;
      max-width: 50%;
      height: 90px;
      overflow: hidden;
    }
    .image-path {
      align-self: flex-end;
    }
    a {
      color: #111;
      text-decoration: none;
    }
    hr {
      width: 100%;
      height: 2px;
      background-color: #111;
    }
    </style>
  </head>
  <body>
  <div class="grid-container">
  `;
  const suffixHTML = `</div></body></html>`;
  let body = "";
  let html = "";
  images.map(obj => {
    body += `
    <div class="element-container">
      <div class="image-box">
        <img src="${obj.base64}" class="image" />
      </div>
      <div class="details-box">
      <h3><b>Original Size: </b>${obj.info.width} X ${obj.info.height}</h3>
      <h3><b>Format: </b>${obj.info.type}</h3>
      <a href=${obj.imgUrl} class="image-path">${obj.imgUrl}</a>
      </div>
    </div>
    <hr/>
    `;
  });
  html = `${prefixHTML}${body}${suffixHTML}`;
  fs.writeFileSync(`${process.cwd()}/${folderName}/index.html`, html);
};

const main = async () => {
  //IF FOLDER NOT EXIST, CREATE ONE
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
  const fetch = await fetchHTML()
    .then(html => parsingHTML(html))
    .then(() => saveAndConvertImages())
    .then(() => createHTMLFile())
    .then(() =>
      console.log(
        `Images downloaded succesfully to ${process.cwd()}/${folderName}`,
      ),
    )
    .catch(err => console.log("Errrrror: ", err));
};

main();

exports.showImages = main;
