#!/bin/bash

 rm -rf ../backend/pb_public/* && npm run build && cp -r dist/* ../backend/pb_public
