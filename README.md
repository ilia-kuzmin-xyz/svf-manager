# Autodesk Forge Viewer App

## Overview

This web application allows you to view Autodesk Forge models locally. It runs on `localhost` at port `3031` and provides a viewer for SVF (Simple Vector Format) models along with their associated resources, such as materials and metadata.

## Getting Started

Follow these steps to get started with the Autodesk Forge Viewer App

## Install Dependencies
```bash
npm install
```

## Start the Server
```bash
node start.js
```

## Access the Application
Open your web browser and visit:
`http://localhost:3031/viewer.html`

# Viewing Models
To view models, make sure they are placed in the `./www/svfs folder`. Each model should be organized in its own folder, which can contain additional files such as materials, metadata, and other associated resources.