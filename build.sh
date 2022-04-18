#! /bin/sh

# exit if a command fails
set -xe

LC_ALL=en_US.UTF-8
LANG=en_US.UTF-8
LANGUAGE=en_US.UTF-8

# Prepare special .npmrc
# we need this because this will copy all files into the node_modules rather than using hard and soft links.
# Because we need to copy the dependencies into the prepared lib.
echo "package-import-method=copy" > .npmrc

# Install pnpm globally
npm i -g pnpm

pnpm i
pnpm circular-check
pnpm eslint
pnpm ts-checks
pnpm ts-emit

mv build /usr/lib/openapi-generator
mv node_modules /usr/lib/openapi-generator/node_modules
