var express = require("express");
var Axios = require("axios");
var bodyParser = require("body-parser");
var path = require("path");
var multer = require("multer");
var fs = require("fs");
const querystring = require("querystring");

var app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname + "/www"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "www", "viewer.html"));
});

var FORGE_CLIENT_ID = "JxzlATA0AGSzRUAd0DJTzmIgdl0AhQdJ";
var FORGE_CLIENT_SECRET = "OEbpa1XexjdxcT0f";
var access_token = "";
var scopes = "data:read data:write data:create bucket:create bucket:read";
const bucketKey = FORGE_CLIENT_ID.toLowerCase() + "_tutorial_bucket";
const policyKey = "transient";

app.set("port", 3031);
var server = app.listen(app.get("port"), function () {
  console.log("Server listening on port " + server.address().port);
});

app.get("/api/forge/oauth", function (req, res) {
  Axios({
    method: "POST",
    url: "https://developer.api.autodesk.com/authentication/v1/authenticate",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    data: querystring.stringify({
      client_id: FORGE_CLIENT_ID,
      client_secret: FORGE_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: scopes,
    }),
  })
    .then(function (response) {
      access_token = response.data.access_token;
      console.log(response);
      res.redirect("/api/forge/datamanagement/bucket/create");
    })
    .catch(function (error) {
      console.log(error);
      res.send("Failed to authenticate");
    });
});

app.get("/api/forge/oauth/public", function (req, res) {
  Axios({
    method: "POST",
    url: "https://developer.api.autodesk.com/authentication/v1/authenticate",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    data: querystring.stringify({
      client_id: FORGE_CLIENT_ID,
      client_secret: FORGE_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "viewables:read",
    }),
  })
    .then(function (response) {
      console.log(response);
      res.json({
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
      });
    })
    .catch(function (error) {
      console.log(error);
      res.status(500).json(error);
    });
});

app.get("/api/forge/datamanagement/bucket/create", function (req, res) {
  Axios({
    method: "POST",
    url: "https://developer.api.autodesk.com/oss/v2/buckets",
    headers: {
      "content-type": "application/json",
      Authorization: "Bearer " + access_token,
    },
    data: JSON.stringify({
      bucketKey: bucketKey,
      policyKey: policyKey,
    }),
  })
    .then(function (response) {
      console.log(response);
      res.redirect("/api/forge/datamanagement/bucket/detail");
    })
    .catch(function (error) {
      if (error.response && error.response.status == 409) {
        console.log("Bucket already exists, skip creation.");
        res.redirect("/api/forge/datamanagement/bucket/detail");
        return;
      }
      console.log(error);
      res.send("Failed to create a new bucket");
    });
});

app.get("/api/forge/datamanagement/bucket/detail", function (req, res) {
  Axios({
    method: "GET",
    url:
      "https://developer.api.autodesk.com/oss/v2/buckets/" +
      encodeURIComponent(bucketKey) +
      "/details",
    headers: {
      Authorization: "Bearer " + access_token,
    },
  })
    .then(function (response) {
      console.log(response);
      res.redirect("/upload.html");
    })
    .catch(function (error) {
      console.log(error);
      res.send("Failed to verify the new bucket");
    });
});

String.prototype.toBase64 = function () {
  return new Buffer(this).toString("base64");
};

const preprocessUpload = (req, res, next) => {
  const upload = multer({ storage: multer.memoryStorage() }).array(
    "filesToUpload[]"
  );

  upload(req, res, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let svfFile = req.files.find(
      (file) => path.extname(file.originalname).toLowerCase() === ".svf"
    );
    if (!svfFile) {
      return res.status(400).json({ error: "No .svf file found" });
    }

    const timestamp = Date.now();
    const folderName =
      svfFile.originalname.replace(".svf", "") + "-" + timestamp;
    const newFolderName = path.join("tmp", folderName);

    fs.mkdir(newFolderName, { recursive: true }, (err) => {
      if (err) throw err;
      req.svfFolderPath = newFolderName;
      next();
    });
  });
};

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, req.svfFolderPath || "tmp/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const newFileName = file.originalname;
    cb(null, newFileName);
  },
});

var upload = multer({ storage: storage });

app.post(
  "/upload",
  preprocessUpload,
  upload.array("filesToUpload"),
  (req, res) => {
    res.send("Files uploaded!");
  }
);

app.get("/api/folders", function (req, res) {
  const directoryPath = path.join(__dirname, "www/svfs");

  fs.readdir(directoryPath, function (err, entries) {
    if (err) {
      res.status(500).send("Unable to scan directory: " + err);
      return;
    }

    // Filter out entries that are not directories or don't contain .svf files
    Promise.all(
      entries.map((entry) => {
        return new Promise((resolve, reject) => {
          const fullPath = path.join(directoryPath, entry);
          fs.stat(fullPath, (err, stats) => {
            if (err) {
              reject(err);
              return;
            }

            if (stats.isDirectory()) {
              fs.readdir(fullPath, (err, files) => {
                if (err) {
                  reject(err);
                  return;
                }

                if (files.some((file) => file.endsWith(".svf"))) {
                  resolve(entry); // This directory contains at least one .svf file
                } else {
                  resolve(null); // No .svf files in this directory
                }
              });
            } else {
              resolve(null); // Not a directory
            }
          });
        });
      })
    )
      .then((results) => {
        // Filter out null values and send the response
        res.json(results.filter((entry) => entry !== null));
      })
      .catch((error) => {
        res.status(500).send("Error processing directory entries: " + error);
      });
  });
});

app.get("/api/folder-contents", function (req, res) {
  const folderName = req.query.folder;
  const directoryPath = path.join(__dirname, "www/svfs", folderName);

  fs.readdir(directoryPath, function (err, files) {
    if (err) {
      res.status(500).send("Unable to scan directory: " + err);
    } else {
      res.json(files);
    }
  });
});
