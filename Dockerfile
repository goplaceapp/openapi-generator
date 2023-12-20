# Use a specific Node.js version
FROM node:21.4.0-alpine3.19

# Copy your project files
COPY . /openapi-generator
WORKDIR /openapi-generator/code

# Install dependencies
RUN npm install

# Set the entrypoint
ENTRYPOINT ["openapi-generator"]
