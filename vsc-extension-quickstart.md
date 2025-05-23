# Welcome to VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your language support and define the location of the grammar file that has been copied into your extension.
* `syntaxes/xpp.tmLanguage.json` - this is the Text mate grammar file that is used for tokenization.
* `language-configuration.json` - this is the language configuration, defining the tokens that are used for comments and brackets.

## Get up and running straight away

* Make sure the language configuration settings in `language-configuration.json` are accurate.
* Press `F5` to open a new window with your extension loaded.
* Create a new file with a file name suffix matching your language.
* Verify that syntax highlighting works and that the language configuration settings are working.

## Make changes

* You can relaunch the extension from the debug toolbar after making changes to the files listed above.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Add more language features

* To add features such as intellisense, hovers and validators check out the [VS Code extenders documentation](https://code.visualstudio.com/docs).

## Install your extension

* To start using your extension with Visual Studio Code, copy it into the `<user home>/.vscode/extensions` folder and restart Code.
* To share your extension with the world, read the [publishing an extension guide](https://code.visualstudio.com/docs).

## Publish Extensions

* Login with your publisher: `vsce login <your-publisher-name>`
  * You may need to create a personal access token by creating an organization on Azure DevOps if you don't have one and create a personal access token.
* Build the package: `vsce package`
* To test locally: `code --install-extension <your-vsix-file>`
* To publish: `vsce publish`

## Run Tests

* npm test
* Run specific test: npm test -- -g "should find all occurrences of a variable across different notations"
* npx mocha -r ts-node/register test/rename.test.ts -g "should find all occurrences of a variable across different notations"
