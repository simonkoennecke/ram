/*
 * Copyright (c) 2013 Simon Koennecke
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

lRegExp = {
'simpleAddr': new RegExp('^\\s*R(\\d+)\\s*$'),
'indirectAddr': new RegExp('^\\s*\\(R(\\d+)\\)\\s*$'),
'realnumber': new RegExp('^\\s*(-\\d+|\\d+)\\s*$'),
'op': new RegExp('^\\s*(\\S+)\\s*:?=\\s*(\\S*)\\s*([+\\-/\\*])\\s*(\\S+)\\s*$'),
'simpleOp': new RegExp('^\\s*(\\S+)\\s*:?=\\s*(\\S+)\\s*$'),
'operand': new RegExp('^\\s*\\S+\\s*=\\s*\\S+\\s*([+\\-/\\*])\\s*\\S+\\s*$'),
'statements': new RegExp('^\\s*(GGZ|GZ|GLZ)\\s*(-\\S+|\\S+)\\s*,\\s*(\\S+)\\s*$'),
'goto': new RegExp('^\\s*GOTO\\s*(\\S+)\\s*$'),
'isLabel': new RegExp('^\\s*(\\S+):([^=]|$)\\s*(.*)'),
'comments': new RegExp('^\\s*(.*)\\s*(;|//)\\s*(.*)\\s*$'),
};

var RAM;
var pauseRun=false;
var timeId=undefined;

jQuery(document).ready(function(){
	var data = ((GetURLParameter('reg') || jQuery('#setRegister').attr('data') || "").split(';'));
	jQuery.map(data, function(val,i){addRegister(val)});
	var code = GetURLParameter('code');
	code = (typeof code == "undefined" || code.trim() == "")?editor.getSession().getValue():unescape(code);
	editor.getSession().setValue((code || ""));
	
	
	jQuery('#run').on('RamCmdExecBefore',function(event, RAM){
		removeAllMarker();
	});
	jQuery('#run').on('RamCmdExecAfter',function(event, RAM, PRM){
		setMarker(RAM);
		changeRegister(RAM);
		
		//NOP is not included...
		if(RAM.code[RAM.lineOfCode-1]!="")
			jQuery('#ram_ekm').val(Number(jQuery('#ram_ekm').val())+1);
		
		var sum = aggregatedLKM(PRM);
		//GOTO delivers a NaN or HALT also.
		if(!isNaN(sum) && isFinite(sum) && sum > 0){			
			jQuery('#ram_lkm').val(Number(jQuery('#ram_lkm').val())+Math.ceil(Math.log(sum)/Math.log(2)));
		}
	});
	jQuery('#run').on('readRegister',function(event, RAM, regId){
		jQuery('#reg_'+regId).addClass('reg-green');
	});
	jQuery('#run').on('writeRegister',function(event, RAM, regId){
		jQuery('#reg_'+regId).addClass('reg-red');
	});
	jQuery('#run').on('indirectRegister',function(event, RAM, regId){
		jQuery('#reg_'+regId).addClass('reg-yellow');
	});
	jQuery('#run').on('RamEmulateStart',function(event, RAM, isRuning){
		statiButtons(RAM, isRuning);
	});
	jQuery('#run').on('RamEmulateEnd',function(event, RAM, isRuning){
		statiButtons(RAM, isRuning);
	});
	jQuery('#run').on('RamEmulatePause',function(event, RAM, isRuning){
		statiButtons(RAM, isRuning);
	});
});
/**
 * Create and show Link with help from bootstrap components
 */
function getLink(){
	var data = loadRegister().join(";");
	var code = editor.getSession().getValue();
	var url = document.URL.substr(0,(((c= document.URL.indexOf('?'))===-1)?document.URL.length:c))+'?reg='+data+'&code='+escape(code);
	jQuery('#ram_url input').attr('value', url);
	alertMsg(jQuery('#ram_url').html(), 'alert-warning');
}
/**
 * Display Message with Bootstrap components
 */
function alertMsg(msg, css){
	if(jQuery('#msg').length === 0){
		jQuery('body').append('<div id="msg" class="alert alert-dismissable fade in"></div>');
	}
	jQuery('#msg').html(msg);
	jQuery('#msg').removeAttr('class');
	jQuery('#msg').addClass('alert fade in '+css);
	jQuery('#msg').prepend('<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>');
	jQuery('#msg').show();
}
/**
 * Stop and Halt RAM and display error
 */
function displayError(RAM, msg){
	var LOC = RAM.lineOfCode; 
	msg = 'RAM stopped on line ' + (LOC+1) + '. '+msg;
	RAM = resetAndstop(RAM, false);
	RAM.isVerify = false;
	RAM.errorInLine.push(LOC);
	setErrorMarker(RAM);
	alertMsg(msg, 'alert-danger');
	return RAM;
}

function statiButtons(RAM, isRuning){
	if(RAM.halt == true){
		jQuery('#ramPause').attr("disabled", true);
		jQuery('#ramNext').attr("disabled", true);
	}
	else if(!(timeId === undefined)){
		jQuery('#ramPause').attr("disabled", false);
		jQuery('#ramNext').attr("disabled", true);				
	}else{
		jQuery('#ramPause').attr("disabled", true);
		jQuery('#ramNext').attr("disabled", false);
	}
}

function addRegister(val){
	if(val == undefined || val == "")
		val = 0;
	var i = jQuery('#setRegister input').length;
	jQuery('#setRegister').append(
		'<div class="input-group input-group-lg">' +
			'<span class="input-group-addon">R'+i+'</span>' +
			'<input type="text" id="reg_' +  i + '" class="form-control" value="'+val+'">' +
		'</div>');
}
function removeRegister(){
	jQuery('#setRegister div').last().remove();
}

function addRunRegister(RAM){
	jQuery.map(RAM.register,function(val,id){
		jQuery('#setRunRegister').append('<input type="text" id="regRun_' + id + '" value='+val+'>');
	});
}
function changeRegister(RAM, reg){
	jQuery.map((reg || RAM.register || []),function(val,id){val = (val == undefined || val == "")?0:val;jQuery('#setRegister #reg_'+id).val(val)});
}

function run(){
	RAM = init();
	RAM.runMode = jQuery('#runMode').val();
	//if(RAM.runMode == "run"){
	//	RAM.RamCmdExecAfter = undefined;
	//}
	//else
	if(RAM.runMode == "debug"){
		if(jQuery.map(editor.getSession().getBreakpoints(), function(val, i){return (val==undefined || i >= editor.getLastVisibleRow())?0:1;}).reduce(function(a,b){return a + b}) == 0){
			RAM = resetAndstop(RAM);
			alertMsg("Please set at least one Breakpoint.", 'alert-danger');
			return;
		}
		RAM.RamCmdExecAfter = function(RAM){
			if(editor.getSession().getBreakpoints()[RAM.lineOfCode] != undefined)
				RAM.isRuning = false;
			return RAM;
		}
		//Check if Breakpoint in first row
		if(RAM.lineOfCode === -1 && editor.getSession().getBreakpoints()[0] != undefined){
			RAM.lineOfCode = 0;
			statiButtons(RAM, RAM.isRuning);
			setMarker(RAM);
			return;
		}
		else if(RAM.lineOfCode === -1){
			RAM.lineOfCode = 0;
		}
	}
	else if(RAM.runMode == "animated" || RAM.runMode == "run"){
		RAM.RamCmdExecAfter = function(RAM){ RAM.isRuning = false; return RAM;}
		if(!RAM.isVerify){
			return;
		}
		//Delete interval call from previous action
		if(!(timeId === undefined))
			timeId = clearInterval(timeId);
		
		//Set interval to call run
		timeId = setInterval(function(){
				RAM = emulate(RAM);
				if(pauseRun || (RAM.lineOfCode > RAM.runCode.length) || RAM.halt){
					pauseRun = false;
					timeId = clearInterval(timeId);
				}
			},((RAM.runMode=="animated")?1000:1));
		statiButtons(RAM, RAM.isRuning);
		//skip emulate in last row
		return;
	}
	
	
	if(RAM.isVerify){
		setMarker(RAM);
		RAM = emulate(RAM);
	}
}

function init(){
	if(typeof RAM != "undefined" && RAM.halt == false && RAM.isVerify == true){
		//Reset animated run
		if(timeId > 0)
			timeId = clearInterval(timeId);
		return RAM;
	}
	jQuery('#ram_ekm').val(0);
	jQuery('#ram_lkm').val(0);
	var registerStartStats = (typeof RAM == "undefined")?undefined:RAM.registerStartStats;
	RAM = {'register': loadRegister(),
		'registerStartStats': (registerStartStats || jQuery.map(jQuery('#setRegister input'),function(el,i){return jQuery(el).val()})),
		'code': prepareCode(editor.getSession().getValue()),
		'label': new Array(),
		'out': jQuery('#run'),//Importen for the Event handling, need to be defined on the html page.
		'lineOfCode': ((jQuery('#runMode').val() === "debug")?-1:0),
		'RamCmdExecAfter': undefined, //A function e.g. RAM = function(RAM){.. return RAM;} after a command, to manipulate the RAM.
		'RamCmdExecBefore': undefined, //see line above
		'errorInLine': new Array(),
		'halt': false};
	
    RAM = extractLabels(RAM);
	RAM = verify(RAM)
	
	if(RAM.isVerify == undefined)
		RAM.isVerify = false;
	
	if(RAM.isVerify == true){
		RAM.runCode = parser(RAM.code);
	}
	
	jQuery('#run').html('');
	
	if(RAM.isVerify && RAM.errorInLine.length == 0){
		setMarker(RAM);
		editor.setReadOnly(true);
	}
	else{
		setErrorMarker(RAM);
	}
	
	return RAM;
}
/**
 * Return a list of the current values of all current set register
 */
function loadRegister(){
	return jQuery.map(jQuery('#setRegister input'),function(el,i){return jQuery(el).val()});
}
/**
 * Execute one line and stop RAM 
 */
function nextStep(){
	RAM.RamCmdExecAfter = function(RAM){RAM.isRuning = false; return RAM;}
	RAM = emulate(RAM);
}
/**
 * Stop and HALT RAM, enable Editor and clear Message.
 */
function resetAndstop(RAM, resetRegister){
	if(RAM == undefined)
		init();
	RAM.isRuning = false;
	RAM.lineOfCode = RAM.code.length+1;
	RAM.halt = true;
	
	removeAllMarker();
	if(RAM == undefined){
		RAM = {'registerStartStats': (((GetURLParameter('reg') || jQuery('#setRegister').attr('data') || "").split(';')))};
	}
	if((typeof resetRegister === "undefined"))
		changeRegister(RAM, RAM.registerStartStats);
	
	jQuery('#msg').alert('close');
	editor.setReadOnly(false);
	timeId = clearInterval(timeId);
	jQuery(RAM.out).trigger("RamEmulateEnd", [RAM, RAM.isRuning]);
	
	return RAM;
}
/**
 * If the RAM is running with the run mode "animated", you can pause the RAM.
 */
function pause(){
	pauseRun = true;
	timeId = clearInterval(timeId);
	jQuery(RAM.out).trigger("RamEmulatePause", [RAM, RAM.isRuning]);
}
/**
 * Display current position of Line of Code
 */
function setMarker(RAM){
	var aceRange = ace.require('ace/range').Range;
	var adjRangeAce = new aceRange(RAM.lineOfCode, 0, RAM.lineOfCode, 1000);
	editor.getSession().addMarker(adjRangeAce,"ace_exec", "background");	
}
/**
 * Mark all lines with an error
 */
function setErrorMarker(RAM){
	jQuery.map((RAM.errorInLine || []), function(row,i){
		var aceRange = ace.require('ace/range').Range;
		var adjRangeAce = new aceRange(row, 0, row, 100);
		editor.getSession().addMarker(adjRangeAce,"ace_error", "background");
	});
}
/**
 * Remove all Markers from editor and set the register color to default
 */
function removeAllMarker(){
	jQuery('#setRegister input').removeClass('reg-green').removeClass('reg-yellow').removeClass('reg-red');
	jQuery.map(editor.getSession().getMarkers(),function(marker,index){editor.getSession().removeMarker(index)})
}
/**
 * String to array of strings. Each array entry is should contain a command
 */
function prepareCode(code){
    var c = code.split('\n');
    //Collect all Commands
    var result = new Array();
    jQuery.map(c,function( val, i ) {
        if((matchs = (lRegExp.comments.exec(val) ||[])).length > 0){
            val = matchs[1]
        }
        val = val.trim();
		result.push(val);
    });
    return result;
}
/**
 * Filter all Labels from Code, check there are doubles.
 */
function extractLabels(RAM){
	labels = new Array();
    RAM.code = jQuery.map(RAM.code,function( cmd, i ) {
        if((matchs = (lRegExp.isLabel.exec(cmd) ||[])).length > 0){
            //Is label already in use?
			if((labels[matchs[1]] || -1) > 0){
				//mark both lines as error
				RAM.errorInLine.push(RAM.label[matchs[3]]);
				RAM.errorInLine.push(i);
				RAM.isVerify = false;
			}
			
			//Use always the last assigent label
			labels[matchs[1]] = i;
			
			return matchs[3];
		}
		else{
			return cmd;
		}
    });
	RAM.label = labels;
    return RAM;
}
/**
 * Is each Command valid?
 */
function verify(RAM){
	var isVerify = true;    
    jQuery.map(RAM.code,function( cmd, i ) {
		isVerify = true;
        if(cmd == "HALT" || cmd == ""){
          //ok
        }
		//Ist es eine Zuweisung?
        else if(cmd.indexOf('=') > 0){
			//R1 = 12 + (R2)		
			if(lRegExp.operand.test(cmd)){
				var matchs = lRegExp.op.exec(cmd);
				if(!verifyOpWithoutNumber(matchs[1])){
					isVerify = false;
				}
				if(!verifyOp(matchs[2]) && matchs[2] != ""){
					isVerify = false;
				}
				if(!verifyOp(matchs[4])){
					isVerify = false;
				}
			}
			//R2 = 12
			else{			
				if(!((matchs = lRegExp.simpleOp.exec(cmd)) == null)){
					if(!verifyOpWithoutNumber(matchs[1])){
						isVerify = false;
					}
					if(!verifyOp(matchs[2])){
						isVerify = false;
					}
				}
				else{
					isVerify = false;
				}
			}
        }
		else if(!((matchs = lRegExp.statements.exec(cmd)) == null)){
			if(!verifyOp(matchs[2]))
				isVerify = false;
			if(!isValidLabel(RAM, matchs[3]))
				isVerify = false;
		}
		else if(!((matchs = lRegExp.goto.exec(cmd)) == null)){
			if(!isValidLabel(RAM, matchs[1]))
				isVerify = false;
		}
        else{
            isVerify = false;
        }
		if(!isVerify){
			RAM.errorInLine.push(i);
			RAM.isVerify = isVerify;
		}
    });
	if(RAM.isVerify == undefined || (RAM.isVerify == true && isVerify == false)){
		RAM.isVerify = isVerify;
	}
	return RAM;
}
/**
 * The used operands are valid?
 */
function verifyOp(operant){
	operant = operant.trim();
	if( lRegExp.simpleAddr.test(operant) || lRegExp.indirectAddr.test(operant) || lRegExp.realnumber.test(operant) )
		return true;
	else
		return false;
}
/**
 * Take the assignment a register
 */
function verifyOpWithoutNumber(operant){
	operant = operant.trim();
	if( lRegExp.simpleAddr.test(operant) || lRegExp.indirectAddr.test(operant))
		return true;
	else
		return false;
}
/**
 * Is label valid?
 */
function isValidLabel(RAM, label){
	label = label.trim();
	if(RAM.label[label] == undefined)
		return false;
	else
		return true;
}
/**
 * Transform string to "run code"
 */
function parser(code, label){
	return jQuery.map(code, function( cmd, i ) {
        if(cmd == "HALT"){
          return setRunCode(function(RAM,PRM){
					return resetAndstop(RAM);					
				}, undefined);
        }
		else if(cmd == ""){ // Like NOP
          return setRunCode(function(RAM,PRM){
					RAM.lineOfCode += 1;
					return RAM;
				}, undefined);
        }
		//Ist es eine Zuweisung?
        else if(cmd.indexOf('=') > 0){
			//R1 = 12 + (R2)
			if(lRegExp.operand.test(cmd)){
				var matchs = lRegExp.op.exec(cmd);
				return setRunCode(function(RAM,PRM){
							var val = 0;
							if(PRM[2] == "+"){
								 val = Number(PRM[1]) + Number(PRM[3]);
							}
							else if(PRM[2] == "*"){
								val = Number(PRM[1]) * Number(PRM[3]);
							}
							else if(PRM[2] == "-"){
								if(PRM[1] == "")
									val = Number(PRM[3]) * -1;
								else
									val = Number(PRM[1]) - Number(PRM[3]);
							}
							else if(PRM[2] == "/"){
								if(Number(PRM[3]) == 0){
									RAM = displayError(RAM, 'Division by zero.');
									return RAM;
								}
								val = Number((Number(PRM[1]) / Number(PRM[3])).toFixed(0));
							}
							if(!isFinite(val)){
								RAM = displayError(RAM, 'Overflow occurred. Please notice the valid number range is '+Number.MIN_VALUE+' to '+Number.MAX_VALUE+'.');
							}
							else{
								RAM = setRegister(RAM,PRM[0],val); 
								RAM.lineOfCode += 1;								
							}
							return RAM;
						},
						[matchs[1],matchs[2],matchs[3],matchs[4]]);
			}
			//R2 = 12
			else{
				var matchs = lRegExp.simpleOp.exec(cmd);
				return setRunCode(function(RAM,PRM){
						RAM = setRegister(RAM, PRM[0], PRM[1]);
						RAM.lineOfCode += 1;
						return RAM;
					},[matchs[1],matchs[2]]);
			}
        }
		else if(!((matchs = lRegExp.statements.exec(cmd)) == null)){
			return setRunCode(function(RAM,PRM){
						if( (PRM[0] === "GZ" && Number(PRM[1]) === 0) || 
							(PRM[0] === "GGZ" && Number(PRM[1]) > 0) || 
							(PRM[0] === "GLZ" && Number(PRM[1]) < 0)){
							RAM.lineOfCode = RAM.label[PRM[2]];
						}
						else{
							RAM.lineOfCode += 1;
						}
						return RAM;
					},
					[matchs[1], matchs[2], matchs[3]]);
		}
		else if(!((matchs = lRegExp.goto.exec(cmd)) == null)){
			return setRunCode(function(RAM,PRM){
						RAM.lineOfCode = RAM.label[PRM[0]];
						return RAM;
					}, [matchs[1]]);
		}
        else{
            return setRunCode(function(RAM,PRM){
						RAM.lineOfCode += 1;
						return RAM;
					}, [matchs[1]]);
        }
    });
}
/**
 * Helper Function to create the "run code"
 */
function setRunCode(cmd, prm){
	return {'cmd': cmd, 'prm': prm};
}
/**
 * RAM initialized code already parsed and executable, now RAM can be simulate.
 */
function emulate(RAM){
	RAM.isRuning = true;
	
	jQuery(RAM.out).trigger('RamEmulateStart', [RAM, RAM.isRuning]);
	
	while(RAM.isRuning){
		if(RAM.lineOfCode < RAM.runCode.length){
			RAM.register =  loadRegister();
			//Prepare Parameter
			var PRM_LGK = prepareParametersForLKM(RAM, RAM.runCode[RAM.lineOfCode].prm);
			//console.log(PRM_LGK);
			
			jQuery(RAM.out).trigger('RamCmdExecBefore', [RAM, PRM_LGK]);
			
			//Run Custom function before
			if(typeof RAM.RamCmdExecBefore == 'function'){
				RAM = (RAM.RamCmdExecBefore(RAM) || RAM);
			}
			
			//Run Statement
			
				var PRM = prepareParameters(RAM, RAM.runCode[RAM.lineOfCode].prm);
			if(RAM.isVerify){
				RAM = RAM.runCode[RAM.lineOfCode].cmd(RAM, PRM);
			}
			
			jQuery(RAM.out).trigger('RamCmdExecAfter', [RAM, PRM_LGK]);
			
			//Run Custom function after
			if(typeof RAM.RamCmdExecAfter == 'function'){
				RAM = (RAM.RamCmdExecAfter(RAM) || RAM);
			}
		}
		else{
			//Stop RAM no more lines, HALT isn't in code...
			RAM = displayError(RAM, 'You need to set a HALT Operation.');
		}
		
		//GUI trigger pause RAM
		if(pauseRun){
			RAM.isRuning = false;
			pauseRun = false;
		}
	}
	jQuery(RAM.out).trigger('RamEmulateEnd', [RAM, RAM.isRuning]);
	return RAM;
}
/**
 * Setze ein Wert in Register.
 */
function setRegister(RAM, id, val){
	if(id >= 0 && id < RAM.register.length){
		RAM.register[id] = val;
		jQuery(RAM.out).trigger('writeRegister',[RAM, id]);
	}
	else{
		RAM = displayError(RAM, 'Register (R'+id+') not exists.');
	}
	return RAM;
}
/**
 * Hier werden die Parameter für jede Instruktion vorbereitet.
 * Beispiel: Annahme: R0 = 1; R1 = 1; R2 = 3; R3 = 5
 * R0 = (R2) + R1 => [R0,(R2),+,R1] => prepareParameters => [0,5,+,1]
 * 
 */
function prepareParameters(RAM, PRM){
	return jQuery.map((PRM || []), function(cmd,i){
		if(cmd == undefined)
			return undefined;
		cmd = cmd.trim();
		if(!((matchs = lRegExp.simpleAddr.exec(cmd)) == null)){
			if(i > 0){
				if(RAM.register[matchs[1]] === undefined){
					RAM = displayError(RAM, 'Register R'+matchs[1]+' not exists.');
				}
				jQuery(RAM.out).trigger("readRegister", [RAM, matchs[1]]);
				
				return RAM.register[matchs[1]];
			}
			else{
				return matchs[1];
			}
		}
		else if(!((matchs = lRegExp.indirectAddr.exec(cmd)) == null)){
			jQuery(RAM.out).trigger("indirectRegister", [RAM, matchs[1]]);
			if(i > 0){
				if(RAM.register[matchs[1]] === undefined){
					RAM = displayError(RAM, 'Register R'+RAM.register[matchs[1]]+' not exists.');
				}
				else if(RAM.register[RAM.register[matchs[1]]] === undefined){
					displayError(RAM, 'Register R'+RAM.register[matchs[1]]+' not exists.');
				}
				
				jQuery(RAM.out).trigger("readRegister", [RAM, RAM.register[matchs[1]]]);
				return RAM.register[RAM.register[matchs[1]]];
			}
			else{
				return RAM.register[matchs[1]];
			}
		}
		else{
			return cmd;
		}
	});
}
/**
 * The Function do mostly the same like prepareParameters() but without to trigger events
 */
function prepareParametersForLKM(RAM, PRM){
	return jQuery.map((PRM || ["0"]), function(cmd,i){
		if(cmd == undefined)
			return "0";
		cmd = cmd.trim();
		if(!((matchs = lRegExp.simpleAddr.exec(cmd)) == null)){
			return String(RAM.register[matchs[1]]);
		}
		else if(!((matchs = lRegExp.indirectAddr.exec(cmd)) == null)){
			return String(aggregatedLKM(RAM.register[RAM.register[matchs[1]]],RAM.register[matchs[1]]));
		}
		else{
			return "0";
		}
	});
}
/**
 * The "LKM" should aggregated as a sum
 */
function aggregatedLKM(val1, val2){
	//return Math.max(Number(val1),Number(val2));
	if(typeof val1 == "string" || typeof val1 == "number")
		return Number(val1) + Number(val2);
	else if(typeof val1 == "object"){
		var sum=0
		for(i=0; i < val1.length; i++)
			sum+=Number(val1[i]);
		return sum;
	}
}

//HELPER
function GetURLParameter(sParam){
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) 
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) 
        {
            return sParameterName[1];
        }
    }
}
