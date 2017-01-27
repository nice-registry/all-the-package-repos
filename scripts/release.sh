#!/usr/bin/env bash

set -x            # print commands before execution
set -o errexit    # always exit on error
set -o pipefail   # honor exit codes when piping
set -o nounset    # fail on unset variables

repo=$npm_package_repository_url
repo="${repo/git+/}"
repo="${repo/.git/}"
project=$(basename $repo)

git clone $repo $project
cd $project
npm run build
npm test
[[ `git status --porcelain` ]] || exit
git add .
git config user.email $npm_package_author_email
git config user.name $npm_package_author_name
git commit -am "update $npm_package_name"
npm version minor -m "bump minor to %s"
npm publish
git push origin master --follow-tags
