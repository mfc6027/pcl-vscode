// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import sourceDataBase from './SourceDataBase';
import * as path from 'path';
import * as util from 'util';
import Tools from './tools';
import { stringify } from 'querystring';
import { trace } from 'console';
import * as fs from "fs";

class ReginItem {
	constructor(begin:number,end:number,type:string,text:string) {
		
	}
}

function getReginItems(text:string):ReginItem[]{
	let reginItems:ReginItem[] = [];
	let index  =0;
	let ct = text;
	let i = ct.search(/^\s*class/igm);
	let j = ct.search(/(?<=^\s*end\s+clas)s\b/img);
	while(i!==-1&&j!==-1){
		reginItems.push({begin:index+i,end:index+j+1,type:"class",text:ct.substring(i,j+1) });
		index =index+ j+1;
		ct=ct.substring(index);
		i = ct.search(/^\s*class/igm);
		j = ct.search(/(?<=^\s*end\s+clas)s\b/img);
	}
	index  =0;
	ct = text;
	i = ct.search(/^\s*function/igm);
	j = ct.search(/(?<=^\s*end\s+functio)n\b/img);
	while(i!==-1&&j!==-1){

		reginItems.push({begin:index+i,end:index+j+1,type:"function",text:ct.substring(i,j+1) });
		index =index+ j+1;
		ct=ct.substring(j+1);

		i = ct.search(/^\s*function/igm);
		j = ct.search(/(?<=^\s*end\s+functio)n\b/img);
	}


	return reginItems;
}
async function processFile(){
	let outText = "";
	const filePath = path.normalize('**/html/*.html');
	const uris = await vscode.workspace.findFiles(filePath);
	for (let i = 0; i < uris.length; i++) {
		const uri = uris[i];
		const readText =await sourceDataBase.readFile(uri.fsPath);
		outText = outText + "\r\n-----"+uri.fsPath+"-------------\r\n";
		const tableReg = /<table\s+class="norule"[\s\S]+?>([\s\S]+?)<\/table>/mig;
		let tableArray = tableReg.exec(readText);
		while(tableArray){
			outText +="\r\n-----------------";
			const trReg = /<tr>([\s\S]+?)<\/tr>/mig;
			let trArray = trReg.exec(tableArray[1]);
			while(trArray){
				outText +="\r\n";
				const tdReg = /<td .*?>([\s\S]+?)<\/td>/mig;
				let tdArray = tdReg.exec(trArray[1]);
				while(tdArray){
					const tdtext = tdArray[1].replace(/<\/?(div|a|span).*?>/img,'').trim();
		
					outText = outText + tdtext+' ';
					tdArray = tdReg.exec(trArray[1]);
				}
				trArray = trReg.exec(tableArray[1]);
			}
			tableArray = tableReg.exec(readText);
		}
	}

	outText = outText.replace(/&nbsp;/gi," ").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&amp;/gi,"&");
	fs.writeFile(`./patran.txt`,outText,function(err){ 
		if(err){
		console.log(err);
		}
	}
		);
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "pcl" is now active!');
	Tools.ExtensionTools.init(context);
	//processFile();
	const disposables: vscode.Disposable[] = [];
	sourceDataBase.casheAllReferenceFile();
	vscode.workspace.onDidChangeConfiguration(async (enevt)=>{
		try {
			if(enevt.affectsConfiguration(sourceDataBase.Configuration.searchPath)){
				sourceDataBase.casheAllReferenceFile();
			}
		} catch (e) {
			
		}
	});
	vscode.workspace.onDidChangeTextDocument(async (enevt)=>{
		try {
			const text = enevt.document.getText();
			
		} catch (e) {
			
		}
	});
	function getCompletionFunction(functionItem:sourceDataBase.FunctionDefinitionItem):vscode.CompletionItem{
		const commitCharacterCompletion = new vscode.CompletionItem(functionItem.defName);
		commitCharacterCompletion.documentation =new vscode.MarkdownString( functionItem.documentation+`\n **From:** ${functionItem.definitionItem.defName}`);
		
		commitCharacterCompletion.kind = vscode.CompletionItemKind.Function;
					
		return commitCharacterCompletion;
	}
	function getVariables(text:string,variableReg:RegExp,index:number){
		let localVariableTable:string[] = [];
		let variableArray = variableReg.exec(text);
		while(variableArray){
			let variableString = variableArray[index].replace(/\(.*?\)|\[.*?\]/g,"");
			if(variableString.endsWith(")")){
				variableString = variableString.substring(0,variableString.length-1);
			}
			if(variableString.trim().length>1){
				variableString.split(',').forEach(value=>{
					const lastIndex = value.indexOf('=');
					if(lastIndex>=0){
						value = value.substr(0, lastIndex);
					}
					localVariableTable.push(value.trim());
				});
			}	
			variableArray = variableReg.exec(text);
		}
		return localVariableTable;
	}
	function trimComment(text:string):string {
		return text.replace(/(\/\*.*?\*\/)|([\$#][ \t][\s\S]*?$)/mgs,"");
	}
	let currentLine:number = 0;
	let variableTable:string[] = [];
	const completionProvider = vscode.languages.registerCompletionItemProvider("pcl",{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext):vscode.CompletionItem[]|undefined{
			
			const start: vscode.Position = new vscode.Position(position.line, 0);
			const range: vscode.Range = new vscode.Range(start, position);
			let text: string = document.getText(range);
			let completionItems:vscode.CompletionItem[] = [];
			const offsetPos = document.offsetAt(position);
			//variable completion
			if(currentLine!==position.line){
				currentLine = position.line;
				
				const absText = document.getText();
				const prevText = trimComment(absText.substring(0,offsetPos));
				const realIndex= prevText.length;
				const realText =prevText.concat(trimComment(absText.substring(offsetPos)));
				const reginItems:any = getReginItems(realText);
				//global variable	
				variableTable = getVariables(realText,/^\s*\bglobal +(integer|real|logical|string|widget)([\s\S]+?)(?:\/|$)/igm,2);
				//find classwide and function variables
				reginItems.forEach((item:any) => {
					//find classwide and function variables
					if(item.type === "class"&&realIndex<item.end&&realIndex>item.begin){
						getVariables(item.text,/^\s*\bclasswide +(integer|real|logical|string|widget)([\s\S]+?)(?:\/|$)/igm,2).forEach(tx=>{
							variableTable.push(tx);
						});
					}
					//find function variables;
					else if(item.type === "function"&&realIndex<item.end&&realIndex>item.begin){
						getVariables(item.text,/^\s*\b((local|static) +)?(integer|real|logical|string|widget|(\s*function\s+\w+\s*\())([\s\S]+?)(?:\/|$)/igm,5).forEach(tx=>{
							variableTable.push(tx);
						});
					}
				});
				variableTable = Array.from(new Set(variableTable));
			}
				
			//class completion
			if(text.endsWith(".")){
				text = text.substring(0,text.length-1).trim();
				const definitionItem =  sourceDataBase.findDefinitionItem(text);
				if(!definitionItem){
					return;
				}
				if(definitionItem instanceof sourceDataBase.ClassDefinitionItem){
					definitionItem.subItems?.forEach((item)=>{
						const completionItem = getCompletionFunction(item);
						completionItem.commitCharacters = ['('];
						completionItems.push(completionItem);
					});
				}
			}
			else{
				//keyword completion
				const keywords = ["BREAK","BY","CASE","CLASS","CLASSWIDE","CONTINUE","DEFAULT","DUMP","ELSE","END","FALSE","FOR","FUNCTION",
				"GLOBAL","IF","INFORMATIVE","INTEGER","LIST","LOCAL","LOGICAL","ON","READONLY","REAL","REPEAT","RETURN","STATIC","STRING",
				"SWITCH","THEN","TO","TRUE","UNTIL","VIRTUAL","WHILE","WIDGET","WIDGET_NULL"];
				keywords.forEach(value=>{
					let completionItem = new vscode.CompletionItem(value);
					completionItem.kind = vscode.CompletionItemKind.Keyword;
					completionItems.push(completionItem);
					completionItem = new vscode.CompletionItem(value.toLowerCase());
					completionItem.kind = vscode.CompletionItemKind.Keyword;
					completionItems.push(completionItem);
				});
				//variable completion
				variableTable.forEach(value=>{
					const completionItem = new vscode.CompletionItem(value);
					completionItem.kind = vscode.CompletionItemKind.Variable;
					completionItems.push(completionItem);
				});
				
				 sourceDataBase.fileDefinitionItems.forEach((fileDefinitionItem:sourceDataBase.FileDefinitionItem)=>{
					fileDefinitionItem.definitionItems.forEach((item:sourceDataBase.DefinitionItem)=>{
						if(item instanceof sourceDataBase.ClassDefinitionItem){
							const commitCharacterCompletion = new vscode.CompletionItem(item.defName);
							commitCharacterCompletion.kind = vscode.CompletionItemKind.Class;
							completionItems.push(commitCharacterCompletion);
						}
						else if(item instanceof sourceDataBase.FunctionDefinitionItem){
							const completionItem = getCompletionFunction(item);
							completionItem.commitCharacters = ['.'];
							completionItems.push(completionItem);
						}
					});
				});
			}
			// return all completion items as array
			return completionItems;
		}
	},".");
	const findFunctionParameterPosition = (text:string):number=>{
		text = text.replace(/\(.*?\)|\[.*?\]/gim,"");
		const matchArray = text.match(/,/g);
		if(matchArray){
			return matchArray.length;
		}
		return 0;
	};
	const signatureProvider = vscode.languages.registerSignatureHelpProvider(
		"pcl", {
			provideSignatureHelp(
				document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):vscode.ProviderResult<vscode.SignatureHelp> {
					const start: vscode.Position = new vscode.Position(position.line, 0);
					const range: vscode.Range = new vscode.Range(start, position);
					let text: string = document.getText(range).trim();
					const regExpArray = /((\w+)\.)?(\w+)\s*\((.*)/gim.exec(text);
					let activeSignature = 0;
				 	let functionItem:sourceDataBase.FunctionDefinitionItem|undefined;
					if(regExpArray===null){
						return;
					}		
					//class
					const findText = regExpArray[1]?regExpArray[2]:regExpArray[3];
		
					const definitionItem:sourceDataBase.DefinitionItem|undefined = sourceDataBase.findDefinitionItem(findText);
					if(!definitionItem){
						return;
					}
					if(definitionItem instanceof sourceDataBase.ClassDefinitionItem){
						functionItem = definitionItem.subItems?.find((item)=>{
							if(item.defName===regExpArray[3]){
								return true;
							}
							return false;
						});
					}
					else if(definitionItem instanceof sourceDataBase.FunctionDefinitionItem){
						functionItem = definitionItem;
					}
					activeSignature = findFunctionParameterPosition(regExpArray[4]);
					if(functionItem){
						const signHelp = new vscode.SignatureHelp();
						const defLabel = functionItem.defLabel;
						const signatureInfo = new vscode.SignatureInformation(defLabel);
						signatureInfo.documentation = new vscode.MarkdownString(`**Input:**  \n${functionItem.inputText}  \n**Output:**  \n${functionItem.outText}`);
						let i = defLabel.indexOf("(")+1;
						functionItem.parameters?.forEach((item)=>{		
							signatureInfo.parameters.push(new vscode.ParameterInformation([i,i+item.length]));	
							i  = i+item.length+1;
						});
						signHelp.signatures.push(signatureInfo);
						signHelp.activeParameter = activeSignature;
						signHelp.activeSignature = 0;
						return signHelp;
					}
			}
		}, '(', ',');
	context.subscriptions.push(completionProvider,signatureProvider);
}

// this method is called when your extension is deactivated	
export function deactivate() {}
