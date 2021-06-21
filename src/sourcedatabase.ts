import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from "fs";
import Tools from './tools';
module SourceDataBase {
    export enum Configuration {
        searchPath="pcl.foldersearch",
        schemaVersion="pcl.schemaVersion",
    }
    export interface DefinitionItem{
        defName:string;
        documentation:string|undefined;
    }
    export class FileDefinitionItem implements DefinitionItem{
        public constructor(public readonly fileToken: string,public defName: string) { };
        documentation: string|undefined;
        definitionItems:DefinitionItem[] = [];
        findItem(defName:string):DefinitionItem|undefined {
            return this.definitionItems.find(item=>{
                return item.defName === defName;
            });
        }
    }
    export class ClassDefinitionItem implements DefinitionItem {
        public constructor(public defName: string,public fileItem:FileDefinitionItem,public location?: vscode.Location) { };
        documentation: string | undefined;
        sourceFile?:string;
        subItems:FunctionDefinitionItem[]=[];
    }
    export class FunctionDefinitionItem  implements DefinitionItem{
        public constructor(public defName: string,public defLabel:string,public definitionItem:DefinitionItem,public location?: vscode.Location) {
         };
        documentation: string | undefined;
        inputText?:string;
        outText?:string;
        parameters?:{
            label: string;
            documentation?: string;
            length:number;
        }[];
    }
    export let fileDefinitionItems:FileDefinitionItem[]=[];
    export async function readFile(file: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            fs.readFile(file, (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(data.toString());
            });
        });
    }
    
    function formatMarkdownText(source:string|null):string{
        if(source===null){
            return "null";
        }
        return source.replace(/\n/g,'  \n').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    async function findAllParseableDocuments(): Promise<vscode.Uri[]> {
        const configuration = vscode.workspace.getConfiguration();
        let filePath = configuration.get<string>(Configuration.searchPath);
    
        if(!filePath){
            filePath = path.normalize('**/*.pcl');
        }
    
        return await vscode.workspace.findFiles(filePath);      
    }
    
    export async function cacheSystemAPI(): Promise<void>{
        const fileDefinitionItem = new FileDefinitionItem(":system","System");
        fileDefinitionItems.push(fileDefinitionItem);
        const configuration = vscode.workspace.getConfiguration();
        let schemaVer = configuration.get<string>(Configuration.schemaVersion);
        if(!schemaVer){
            return;
        }
        const text = await readFile(path.join(Tools.ExtensionTools.extensionPath,`/schema/`,schemaVer));
        if(!text){
            return;
        }
        //split every function
        const funReg = /^-{8,}([\s\S]+?(?=-{8,}))/gm;
        let functionRegArray = funReg.exec(text);
        while(functionRegArray){
            const detailArray = /^((\w+)\.)?((\w+)\s*\(([^\)]*?)\))$/gm.exec(functionRegArray[1]);
            if(!detailArray){
                console.log("warning:"+functionRegArray[1]+" can't paired!");
                functionRegArray = funReg.exec(text);
                continue;
            }
            let parentDef:DefinitionItem|undefined;
            if(detailArray[1]){
                parentDef = fileDefinitionItem.findItem(detailArray[2]);
                if(parentDef===undefined){
                    parentDef = new ClassDefinitionItem(detailArray[2],fileDefinitionItem);
                    fileDefinitionItem.definitionItems.push(parentDef);
                }
            }
            else{
                parentDef = fileDefinitionItem;
            }
            const funDef = extractFuntion(detailArray[4],detailArray[3],parentDef,detailArray[5]);
            funDef.documentation  =  formatMarkdownText(`#### ${funDef.defLabel}`);
            const detailText = functionRegArray[1] +"---------";
            const description = /(^Description:([\s\S]*?))?(^Input:([\s\S]*?))?(^Output:\s([\s\S]*?))?(^Error Conditions:\s([\s\S]*?))?(?=-{8,})/gm.exec(detailText);
            if(description){
                if(description[2]){
                    funDef.documentation+=`\n**Description:**${formatMarkdownText(description[2])}`;
                }
                if(description[4]){
                    funDef.inputText = formatMarkdownText(description[4]);
                }
                if(description[6]){
                    funDef.outText = formatMarkdownText(description[6]);
                }
                if(description[8]){
                    funDef.documentation+=`\n**Error Conditions:**\n\n${formatMarkdownText(description[8])}`;
                }
            }
            if(parentDef instanceof ClassDefinitionItem){
                parentDef.subItems.push(funDef);
            }
            else if(parentDef instanceof FileDefinitionItem){
                parentDef.definitionItems.push(funDef);
            }
            functionRegArray = funReg.exec(text);
        }
    }
    function extractFuntion(functionName:string,label:string,parent:DefinitionItem,parameter:string|undefined):FunctionDefinitionItem{
        const funDef = new FunctionDefinitionItem(functionName,label,parent);
        //split parameters  
        if(parameter){
            funDef.parameters = [];
            const params = parameter.split(",");
            params.forEach((param)=>{
                funDef.parameters?.push({
                    length:param.length,
                    label:param.trim()
                });
            });
        }
        funDef.definitionItem = parent;
        return funDef;
    }
    export function findDefinitionItem(token:string): DefinitionItem|undefined{
        for (let index = 0; index < fileDefinitionItems.length; index++) {
            const element = fileDefinitionItems[index];
            const definedItem = element.definitionItems.find((item) => {
                if (item.defName === token) {
                    return true;
                }
                return false;
            });
        if(definedItem){
            return definedItem;
        }
        } 

        return;
    }
    export async function casheAllReferenceFile() {
        fileDefinitionItems= [];
        cacheSystemAPI();
        const fileUris:vscode.Uri[] = await findAllParseableDocuments();
        if (!fileUris || fileUris.length === 0) {
            vscode.window.showInformationMessage("no documents Found");
            return;
        }
        fileUris.forEach(uri=>{cacheReferenceFile(uri);});
    }
    export async function cacheReferenceFile(fileUri:vscode.Uri): Promise<void> {
        const pclText = await readFile(fileUri.fsPath);
        const fileDefinitionItem = new FileDefinitionItem(fileUri.fsPath,fileUri.fsPath);
        fileDefinitionItems.push(fileDefinitionItem);
        //split the source text according the 'end class'.one class for one text document.
        const classTexts = pclText.split(/end\s+class/gi);
        //collect class information
        classTexts.forEach((classText)=>{
            let classRegArray = /CLASS\s+(\w+)/gi.exec(classText);
            if(classRegArray){
            const classDef = new ClassDefinitionItem(classRegArray[1],fileDefinitionItem);
            fileDefinitionItem.definitionItems.push(classDef);
        
            //find function for this class
            const funReg = /^\s*function\s+((\w+)\s*\((.*?)(\)(?![,\)])))/gim;
            let functionRegArray = funReg.exec(classText);
            while(functionRegArray){
                const funDef = extractFuntion(functionRegArray[2],functionRegArray[1],classDef,functionRegArray[3]);
                classDef.subItems?.push(funDef);  
                functionRegArray = funReg.exec(classText);
            }
            }
        });
    }
}
export default SourceDataBase;