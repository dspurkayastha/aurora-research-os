#!/bin/bash
tsc -p tsconfig.json
node fix-exports.js

