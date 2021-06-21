import * as vscode from 'vscode';
module Tools {

    export class ExtensionTools {
        static init(context: vscode.ExtensionContext) {
            this.extensionPath = context.extensionPath;
        }
       static extensionPath ="";
    }
}
export default Tools;