#!/bin/bash

npx concurrently -n "BACKEND,FRONTEND" -c "blue,magenta" \
  "cd HMS && ./mvnw spring-boot:run" \
  "cd hms-frontend && npm run dev"
