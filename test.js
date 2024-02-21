// var pdfjsLib = globalThis.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.mjs';


let ParsePDFTest = {};
window.ParsePDFTest = ParsePDFTest;
window.onload = function() {
	let contentFrame = document.getElementById('content');
	let fileButton = document.createElement('input');
	fileButton.id = ('file-input-button');
	fileButton.type = 'file';
	fileButton.onchange = LoadFile;
	contentFrame.firstChild && contentFrame.insertBefore(fileButton, contentFrame.firstChild) || contentFrame.appendChild(fileButton);
}

function LoadFile(event) {
	let file = event.target.files[0];
	let fileReader = new FileReader();

	fileReader.onload = function () {
		try {
			let buffer = new Uint8Array(this.result);
			let loadingTask = pdfjsLib.getDocument(buffer);
			loadingTask.promise.then(ParsePDF);
			console.log('done');
		} catch (error) {
			console.error(error);
			return null;
		}
	};

	fileReader.readAsArrayBuffer(file);
}

function floatSort(a, b) {
	let floatA = parseFloat(a);
	let floatB = parseFloat(b);
	if (isNaN(floatA) && isNaN(floatB)) { return 0; }
	if (isNaN(floatA) || (floatA < floatB)) { return -1; }
	if (isNaN(floatB) || (floatA > floatB)) { return 1; }
	return 0;
}

function roundDecimal(num, decimals = 0) {
	return Number(Math.round(parseFloat(num).toFixed(32) + 'e' + decimals) + 'e-' + decimals);
	// return Math.round( (num * Math.pow(10, decimals)) / Math.pow(10, decimals) );
}


const PAGE_START = 13;
const PAGE_END = 267;
const TRANSFORM_PRECISION = 0.01;
const TRANSFORM_OFFSET_PRECISION_DECIMALS = 2;
const BORDER_PRECISION_DECIMALS = 4;

const FIELDNAMES = [
	'ucs2',
	'ch',
	'typ',
	'rg',
	'rad',
	'ref1',
	'ref2',
	'en',
	'pn',
	'jyutping',
	'cl',
	'sc',
];

const PAGE_FIELD_HEADERS = [
	'ucs2',
	'ch',
	'typ',
	'rg',
	'rad',
	'ref',
	'en',
	'pn',
	'jyutping',
	'cl',
	'sc',
	'rg rad',
	'cl sc',
];

const TABLE_COL_SIZE = 134.76;
const TABLE_ROW_SIZE = 19.7999;
// const TABLE_ROW_SIZE = 19.8;
const TABLE_OFFSET_X = 0;
const TABLE_OFFSET_Y = 18.72;

const FIELD_OFFSET_X = {
	 '0.00' : 'ucs2',
	'16.92' : 'ch',
	'33.96' : 'rg|typ',
	//  '33.96' : 'rg',
	//  '33.96' : 'typ',
	'39.72' : 'rad',
	'50.88' : 'ref1|ref2',
	'84.96' : 'en|jyutping',
	//  '84.96' : 'en',
	//  '84.96' : 'jyutping',
	'90.60' : 'pn',
	'102.00' : 'cl',
	'110.52' : 'sc',
};
const FIELD_OFFSET_Y = {
	'ucs2' : '0.96',
	'ch'   : '6.36',
	'typ'  : '0.96',
	'ref1' : '2.40',
	'ref2' : '9.24',
	'en'   : '0.96',
	'pn'   : '0.96',
	'cl'   : '0.00',
	'sc'   : '0.96',
	'rg'   : '9.36',
	'rad'  : '9.36',
	'jyutping' : '9.48',
};

const FIELD_PATTERNS = {
	'ucs2' : /^[0-9A-F]{4}$/,
	'ch'   : /^.{1}$/,
	'typ'  : /^([<#>S\$]|\*{1,4})(;([<#>S\$]|\*{1,4}))*$/,
	'ref1' : /^.{1}$/,
	'ref2' : /^[0-9A-F]{4}$/,
	'en'   : /^(t|s)$/,
	'pn'   : /^1?\d$/,
	'cl'   : /^又$/,
	'sc'   : /^\d(.\d)?$/,
	'rg'   : /^\d$/,
	'rad'  : /^部$/,
	'jyutping' : /^[a-z]+\d{1}(\s[a-z]+\d{1})*$/,
	// 'jyutping' : /^[a-z]+\d{1}$/,
	// '' : ,
}
function ValidateData(str, type) {
	return ( FIELD_PATTERNS[type] && FIELD_PATTERNS[type].test(str) );
}

const FIELD_PATTERNS_ALT ={
	'en pn': /^(t|s)\s1?\d$/,
	'ref2 ref2': /^[0-9A-F]{4}\s[0-9A-F]{4}$/,
};
function ValidateDataAlt(str, type) {
	// console.log(str, type, FIELD_PATTERNS_ALT[type].test(str));
	return ( FIELD_PATTERNS_ALT[type] && FIELD_PATTERNS_ALT[type].test(str) );
}

async function ParsePDF(pdf) {
	// ParsePDFTest.pdf = pdf;

	let getPageTasks = [];
	for (let pageNumber = PAGE_START; pageNumber <= PAGE_END; pageNumber++) {
		if (pageNumber > 0 && pageNumber <= pdf.numPages) {
			getPageTasks.push(pdf.getPage(pageNumber));
		}
	}

	const result = await Promise.all(getPageTasks).then( async (pages) => {
		console.log('Page loading completed.');

		ParsePDFTest.pages = [];
		let pageCount = 0;
		let entryCount = 0;

		let parsePageTasks = [];
		pages.forEach( page => parsePageTasks.push(ParsePage(page)) );
		const parseResult = await Promise.all(parsePageTasks).then( (parsedPages) => {
			parsedPages.forEach(pageData => {
				if (pageData && pageData.pageNumber && pageData.entryCount) {
					ParsePDFTest.pages[pageData.pageNumber] = pageData;
					entryCount += pageData.entryCount;
					pageCount++;
				}
			});
			console.log(`Page parsing completed with ${pageCount} pages and ${entryCount} entries.`);

			let text = GetTextTable(ParsePDFTest.pages);
			// console.log(text);
			let outFrame = document.createElement('pre');
			outFrame.textContent = text;
			document.getElementById('content').appendChild(outFrame);

		}).catch(error  => {console.log('Page parsing failed.', error);});

	}).catch(error  => {console.log('Page loading failed.', error);});
}


async function ParsePage(page) {
	const pageNumber = page.pageNumber;

	const textContent = await page.getTextContent();

	// use the "ucs2" table field header as origin point for relative entry positions
	// get all x values, and origin x coordinate
	let tXItems = {};
	let tOriginX = null;
	textContent.items.forEach(item => {
		let text = item.str.trim();
		if ( text == '') { return; }
		if ( !( (item.fontName == 'g_d0_f1' || item.fontName == 'g_d0_f2') && PAGE_FIELD_HEADERS.includes(text) ) ) {
			let xCoord = item.transform[4];
			let yCoord = item.transform[5];
			if (!tXItems[xCoord]) { tXItems[xCoord] = []; }
			tXItems[xCoord].push(text);
		} else if ( text != '' && ((item.fontName == 'g_d0_f1' || item.fontName == 'g_d0_f2') && text == 'ucs2') ) {
			let xCoord = item.transform[4];
			tOriginX = xCoord;
		}
	});
	let tXKeys = Object.keys(tXItems).sort(floatSort);
	// console.log(tXKeys, tXItems);

	// get all y values, and origin y coordinate
	let tYItems = {};
	let tOriginY = null;
	textContent.items.forEach(item => {
		let text = item.str.trim();
		if ( text == '' ) { return; }
		if ( !( (item.fontName == 'g_d0_f1' || item.fontName == 'g_d0_f2') && PAGE_FIELD_HEADERS.includes(text) ) ) {
			let xCoord = item.transform[4];
			let yCoord = item.transform[5];
			if (!tYItems[yCoord]) { tYItems[yCoord] = []; }
			tYItems[yCoord].push(text);
		} else if ( (item.fontName == 'g_d0_f1' || item.fontName == 'g_d0_f2') && text == 'ucs2' ) {
			let yCoord = item.transform[5];
			tOriginY = yCoord;
		}
	});
	let tYKeys = Object.keys(tYItems).sort(floatSort).reverse();
	// console.log(tYKeys, tYItems);

	// console.log('origin:', tOriginX, tOriginY);

	// calculate entry x borders
	let startX = tOriginX + TABLE_OFFSET_X + TABLE_COL_SIZE;
	let tXBorders = [roundDecimal(tOriginX + TABLE_OFFSET_X, BORDER_PRECISION_DECIMALS)];
	tXKeys.forEach((xKey) => {
		if ( Math.abs(startX - xKey) <= TRANSFORM_PRECISION || xKey > startX ) {
			tXBorders.push(roundDecimal(startX, BORDER_PRECISION_DECIMALS));
			startX += TABLE_COL_SIZE;
		}
	});
	tXBorders.push(roundDecimal(startX, BORDER_PRECISION_DECIMALS));

	// calculate entry y borders
	let startY = tOriginY - TABLE_OFFSET_Y - TABLE_ROW_SIZE;
	let tYBorders = [roundDecimal(tOriginY - TABLE_OFFSET_Y, BORDER_PRECISION_DECIMALS)];
	tYKeys.forEach((yKey) => {
		if ( Math.abs(startY - yKey) <= TRANSFORM_PRECISION || yKey < startY ) {
			tYBorders.push(roundDecimal(startY, BORDER_PRECISION_DECIMALS));
			startY -= TABLE_ROW_SIZE;
		}
	});
	tYBorders.push(roundDecimal(startY, BORDER_PRECISION_DECIMALS));

	// console.log(tXBorders, tYBorders);

	// place items in entry grid sections
	function getXSection(coord, borders) {
		for (let i = 0; i < borders.length - 1; i++) {
			let start = borders[i];
			let end = borders[i + 1];
			if ( (Math.abs(coord - start) <= TRANSFORM_PRECISION || coord > start) && (coord < end) ) {
				return i;
			}
		}
	}

	function getYSection(coord, borders) {
		for (let i = 0; i < borders.length - 1; i++) {
			let start = borders[i];
			let end = borders[i + 1];
			if ( (Math.abs(coord - start) <= TRANSFORM_PRECISION || coord < start) && (coord > end) ) {
				return i;
			}
		}
	}

	let pageItems = [];
	textContent.items.forEach((item) => {
		let text = item.str.trim();
		if ( text != '' && !(item.fontName == 'g_d0_f1' && PAGE_FIELD_HEADERS.includes(text)) ) {
			let scale1 = item.transform[0];
			let scale2 = item.transform[3];
			let xCoord = item.transform[4];
			let yCoord = item.transform[5];

			let xSection = getXSection(xCoord, tXBorders);
			let ySection = getYSection(yCoord, tYBorders);

			if (xSection !== null && ySection !== null) {
				if (pageItems[xSection] === undefined) { pageItems[xSection] = []; }
				if (pageItems[xSection][ySection] === undefined) { pageItems[xSection][ySection] = []; }
				pageItems[xSection][ySection].push(item);
			}
		}
	});
	// console.log('entries', pageItems);

	function IdentifyItem(item, entryX, entryY, col, row) {
		let type;
		const itemX = item.transform[4];
		const itemY = item.transform[5];
		const itemOffsetX = (itemX - entryX).toFixed(TRANSFORM_OFFSET_PRECISION_DECIMALS);
		const itemOffsetY = Math.abs(itemY - entryY).toFixed(TRANSFORM_OFFSET_PRECISION_DECIMALS);
		// console.log(item.str, `o[${originX},${originY}]; i[${itemX}, ${itemY}]; di[${itemOffsetX},${itemOffsetY}];`);

		// id field by x position
		type = FIELD_OFFSET_X[itemOffsetX];
		// if multiple fields, id by y position
		switch (type) {
			case 'rg|typ': {
				if (itemOffsetY == FIELD_OFFSET_Y['rg'] ) { type = 'rg'; }
				if (itemOffsetY == FIELD_OFFSET_Y['typ'] ) { type = 'typ'; }
				break;
			}
			case 'ref1|ref2': {
				if (itemOffsetY == FIELD_OFFSET_Y['ref1'] ) { type = 'ref1'; }
				if (itemOffsetY == FIELD_OFFSET_Y['ref2'] ) { type = 'ref2'; }
				break;
			}
			case 'en|jyutping': {
				if (itemOffsetY == FIELD_OFFSET_Y['en'] ) { type = 'en'; }
				if (itemOffsetY == FIELD_OFFSET_Y['jyutping'] ) { type = 'jyutping'; }
				break;
			}
		}

		// if not at standard positions, check 'ref' y positions
		if (type === undefined) {
			if (itemOffsetY == FIELD_OFFSET_Y['ref1'] ) { type = 'ref1'; }
			if (itemOffsetY == FIELD_OFFSET_Y['ref2'] ) { type = 'ref2'; }
		}

		let isValid = ValidateData(item.str, type);
		// check multi-fields
		if ( !isValid && ValidateDataAlt(item.str, 'en pn') ) { type = 'en pn'; isValid = true; }
		if ( !isValid && ValidateDataAlt(item.str, 'ref2 ref2') ) { type = 'ref2 ref2'; isValid = true; }
		!isValid && console.warn(`Field value pattern is not valid: p:${pageNumber}, x:${col}, y:${row}, type:${type}, str:"${item.str}", item, pageEntries[x][y]`);

		return type;
	}

	function FixENFieldData(str, entryNode) {
		let tokens = str.split(' ');
		if (tokens.length == 2 && ValidateData(tokens[0],'en') && ValidateData(tokens[1],'pn')
		&& entryNode.data['en'] === undefined && entryNode.data['pn'] === undefined) {
				entryNode.data['en'] = tokens[0];
				entryNode.data['pn'] = tokens[1];
				delete entryNode.data['en pn'];
				return true;
		} else {
			return false;
		}
	}

	function FixREF1FieldData(entryNodeData) {
		let isValid = true;
		let xCoordBuffer = {};
		entryNodeData['ref1_buf'].forEach(item => {
			let xCoord = item.transform[4].toFixed(TRANSFORM_OFFSET_PRECISION_DECIMALS);
			if (xCoordBuffer[xCoord] === undefined) {
				xCoordBuffer[xCoord] = item;
			} else {
				isValid = false;
				return;
			}
		});

		let keys = Object.keys(xCoordBuffer).sort(floatSort);
		let mergedValue = '';
		keys.forEach(key => {
			if ( ValidateData(xCoordBuffer[key].str, 'ref1') ) {
				mergedValue += xCoordBuffer[key].str + ' ';
			} else {
				isValid = false;
				return;
			}
		});

		if (isValid) {
			entryNodeData['ref1'] = mergedValue.trim();
			delete entryNodeData['ref1_buf'];
		}
		return isValid;
	}

	function FixREF2FieldData(entryNodeData) {
		let isValid = true;
		let mergedBuffer;
		if (entryNodeData['ref2_buf'] !== undefined) {
			mergedBuffer = entryNodeData['ref2_buf'];
		}
		if (entryNodeData['ref2 ref2_buf'] !== undefined) {
			if (mergedBuffer !== undefined) {
				mergedBuffer = mergedBuffer.concat(entryNodeData['ref2 ref2_buf']);
			} else {
				mergedBuffer = entryNodeData['ref2 ref2_buf'];
			}
		}

		let xCoordBuffer = {};
		mergedBuffer.forEach(item => {
			let xCoord = item.transform[4].toFixed(TRANSFORM_OFFSET_PRECISION_DECIMALS);
			if (xCoordBuffer[xCoord] === undefined) {
				xCoordBuffer[xCoord] = item;
			} else {
				isValid = false;
				return;
			}
		});

		let keys = Object.keys(xCoordBuffer).sort(floatSort);
		let mergedValue = '';
		keys.forEach(key => {
			if ( ValidateData(xCoordBuffer[key].str, 'ref2') || ValidateDataAlt(xCoordBuffer[key].str, 'ref2 ref2')) {
				mergedValue += xCoordBuffer[key].str + ' ';
			} else {
				isValid = false;
				return;
			}
		});

		if (isValid) {
			entryNodeData['ref2'] = mergedValue.trim();
			delete entryNodeData['ref2_buf'];
			delete entryNodeData['ref2 ref2_buf'];
		}
		return isValid;
	}

	let pageEntries = [];
	let entryCount = 0;
	for (let x = 0; x < pageItems.length; x++) {
		for (let y = 0; y < pageItems[x].length; y++) {
			let items = pageItems[x][y];
			if (pageEntries[x] === undefined) { pageEntries[x] = []; }
			if (pageEntries[x][y] === undefined) {
				pageEntries[x][y] = {
					'entry': entryCount,
					'items': items,
					'data': {},
					'tX': tXBorders[x],
					'tY': tYBorders[y],
				};
			}
			entryCount += 1;
			
			items.forEach(item => {
				let type = IdentifyItem(item, tXBorders[x], tYBorders[y], x, y);
				if (type == null || type === undefined) {
					console.warn(`Unable to determine field type: Page:${pageNumber}; x:${x}; y:${y}; str:"${item.str}"; ${item}`);
				} else {
					if (type == 'ref1' || type == 'ref2' || type == 'ref2 ref2') {
						if ( pageEntries[x][y].data[type+'_buf'] === undefined ) { pageEntries[x][y].data[type+'_buf'] = []; }
						pageEntries[x][y].data[type+'_buf'].push(item);
					} else {
						if ( pageEntries[x][y].data[type] !== undefined ) {
							console.warn('Data already defined', pageNumber, x, y, type, pageEntries[x][y], item);
						} else {
							pageEntries[x][y].data[type] = item.str;
						}
					}
				}
			});

			// split 'en pn' field values
			if (pageEntries[x][y].data['en pn']) {
				let isFixed = FixENFieldData(pageEntries[x][y].data['en pn'], pageEntries[x][y]);
				!isFixed && console.warn(`Data fix: Page:${pageNumber}; x:${x}; y:${y}; str:"${pageEntries[x][y].data['en pn']}"; isFixed: ${isFixed};`, pageEntries[x][y].data);
			}
			// TODO: handle ref buffers (sort, validate)
			if (pageEntries[x][y].data['ref2_buf'] || pageEntries[x][y].data['ref2 ref2_buf']) {
			// if (pageEntries[x][y].data['ref2_buf'] && pageEntries[x][y].data['ref2 ref2_buf']) {
				let isFixed = FixREF2FieldData(pageEntries[x][y].data);
				!isFixed && console.warn(`Data fix: Page:${pageNumber}; x:${x}; y:${y}; str:"${pageEntries[x][y].data['ref2']}"; isFixed: ${isFixed};`, pageEntries[x][y].data);
				// console.warn(`Data fix: Page:${pageNumber}; x:${x}; y:${y}; str:"${pageEntries[x][y].data['ref2']}"; isFixed: ${isFixed};`, pageEntries[x][y].data);
			}
			if (pageEntries[x][y].data['ref1_buf']) {
				let isFixed = FixREF1FieldData(pageEntries[x][y].data);
				!isFixed && console.warn(`Data fix: Page:${pageNumber}; x:${x}; y:${y}; str:"${pageEntries[x][y].data['ref1']}"; isFixed: ${isFixed};`, pageEntries[x][y].data);
			}
		}
	}

	return {
		'pageNumber' : pageNumber,
		'entryCount' : entryCount,
		'entries': pageEntries,
	};
}


function GetTextTable(pages) {
	let textOutput = '';
	let entryNumber = 1;
	pages.forEach(page => {
		let pageNumber = page.pageNumber;
		let entries = page.entries;
		let pageEntryNumber = 1;

		entries.forEach( (column, indexX) => {
			column.forEach( (entry, indexY) => {
				let entryLine = `${entryNumber}\t${pageNumber}\t${pageEntryNumber}\t${indexX+1}\t${indexY+1}\t`;
				FIELDNAMES.forEach(fieldName => {
					entryLine += ( (entry.data[fieldName] !== undefined && entry.data[fieldName]) || '' ) + '\t';
				});
				textOutput += entryLine.trim() + '\n';

				pageEntryNumber++;
				entryNumber++;
			});
		});
	});

	return textOutput;
}

