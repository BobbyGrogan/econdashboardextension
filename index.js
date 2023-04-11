// get required libraries
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// for when we get the contents of the public folder which includes stylesheet, fonts, etc.
const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf'
};

// function that gets values from fred api, takes in id for type of data and day for what day
function getFredData(id, date) {
  return new Promise((resolve, reject) => {
    const url = "https://api.stlouisfed.org/fred/series/observations?series_id=" + id + "&observation_start=" + date + "&observation_end=" + date + "&api_key=##";
    let xmlData = '';

    https.get(url, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        xmlData += chunk;
      });
      res.on('end', () => {
        xml2js.parseString(xmlData, (err, result) => {
          if (err) {
            reject(err);
          } else {
            const value = result?.observations?.observation?.[0]?.$.value;
            if (value) {
              resolve(value);
            } else {
              reject(new Error('Value not found in response'));
            }
          }
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function findRecentValue(id, startDate) {
  let currentDate = new Date(startDate);
  let mostRecentValue;
  
  while (!mostRecentValue) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    try {
      const data = await getFredData(id, dateStr);
      mostRecentValue = data;
    } catch (err) {
      // Ignore errors, try again with previous date
    }
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  return mostRecentValue;
}


async function main() {

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const day = currentDate.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;


  // get economic data from FRED for each wanted category
  var cornOneValue = await findRecentValue("DTB1YR", formattedDate);
  var usaGdpValue = await findRecentValue("GNPCA", "2022-01-02");
  var usaUnemploymentValue = await findRecentValue("UNRATE", formattedDate);
  var usaTenYrYieldValue = await findRecentValue("DGS10", formattedDate);
  var usaCpiInflationValue = await findRecentValue("CPIAUCSL", formattedDate);
  var wtiCrudeValue = await findRecentValue("DCOILWTICO", formattedDate);

  console.log(usaGdpValue);

  // html which is constant
  var fileBegin = '<!DOCTYPE html><html><head><title>Extennsion</title><link rel="stylesheet" href="styles.css"><meta charset="utf-8"></head>';
  var fileBodyBegin = '<body><div class="stuff"><a class="arrow-link" href="###"><div class="arrow left">&#8592;</div></a><div class="title">Economic Data</div><a class="arrow-link" href="##"><div class="arrow right">&#8594;</div></a>';
  var fileEnd = '</div></body></html>';

  // html which includes variable economic data
  var usaGdpHtml = '<div class="data middle"><div class="type">USA GDP:</div><div id="usa-gdp">' + usaGdpValue + '</div></div>';
  var usaUnemploymentHtml = '<div class="data middle"><div class="type">Unemployment:</div><div id="usa-unemployment">' + usaUnemploymentValue + '</div></div>';
  var usaTenYrYieldHtml = '<div class="data middle"><div class="type">10yr Yield:</div><div id="usa-10yr-bond-yield">' + usaTenYrYieldValue + '</div></div>';
  var usaCpiInflationHtml = '<div class="data bottom"><div class="type">USA Inflation:</div><div id="usa-inflation">' + usaCpiInflationValue + '</div></div>';
  var wtiCrudeHtml = '<div class="data bottom"><div class="type">WTI Crude:</div><div id="wti-crude">' + wtiCrudeValue + '</div></div>';
  var cornOneHtml = '<div class="data bottom"><div class="type">Corn:</div><div id="usa-corn">' + cornOneValue + '</div></div>';

  // combine all html which will be added to file
  const fileContent = fileBegin + fileBodyBegin + usaGdpHtml + usaUnemploymentHtml + usaTenYrYieldHtml + usaCpiInflationHtml + wtiCrudeHtml + cornOneHtml + fileEnd;

  // Set the public directory path
  const public = path.join(__dirname, 'public');

  // Create an HTTP server and handle requests
  const server = http.createServer(function(req, res) {

    // Determine the file path based on the request URL
    const filePath = req.url === '/' ? path.join(public, 'index.html') : path.join(public, req.url);
    // Determine the file extension of the requested file
    const fileExtension = path.extname(filePath).toLowerCase();
    // Determine the content type of the requested file based on its extension
    const contentType = contentTypes[fileExtension] || 'application/octet-stream';

    if (filePath === path.join(public, 'index.html')) {
      // If request is for index.html, create the file and write contents to it
      fs.writeFile(filePath, fileContent, function(err) {
        if (err) {
          // If an error occurs while creating the file, send a 500 response
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.write('Error creating file');
          return res.end();
        }

        // If file is successfully created, send a 200 response with the file contents
        res.writeHead(200, { 'Content-Type': contentType });
        res.write(fileContent);
        return res.end();
      });
    } else {
      // If request is for a file other than index.html, read the file and send its contents
      fs.readFile(filePath, function(err, data) {
        if (err) {
          // If an error occurs while reading the file, send a 404 response
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.write('File not found!');
          return res.end();
        }
        // If file is successfully read, send a 200 response with the file contents
        res.writeHead(200, { 'Content-Type': contentType });
        res.write(data);
        return res.end();
      });
    }
  });

  // Start the server and listen on port 3000
  server.listen(3000, function() {
    console.log('Server listening on port 3000!');
  });

}

main()