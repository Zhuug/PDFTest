// var pdfjsLib = globalThis.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.mjs';


let ParsePDFTest = {};
window.ParsePDFTest = ParsePDFTest;
window.onload = function() {
	let contentFrame = document.getElementById('content');
	let fileButtonPDF = document.createElement('input');
	fileButtonPDF.id = ('file-input-button');
	fileButtonPDF.type = 'file';
	fileButtonPDF.accept = ".pdf";
	fileButtonPDF.onchange = LoadFile;
	contentFrame && contentFrame.appendChild(fileButtonPDF);
}

function LoadFile(event) {
	let file = event.target.files[0];
	let fileReader = new FileReader();

	fileReader.onload = function (event) {
		try {
			ParsePDFTest.startTime = Date.now();
			
			let buffer = new Uint8Array(this.result);
			ParsePDFTest.sourceFileName = file.name;
			ParsePDFTest.sourceFileSize = buffer.length;

			let loadingTask = pdfjsLib.getDocument(buffer);
			loadingTask.promise.then(ParsePDF);
		} catch (error) {
			console.error(error);
			return null;
		}
	};

	fileReader.readAsArrayBuffer(file);
}


// util
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


// Unicode Basic Multilingual Plane Private Use Area range
const BMP_PUA_START = 0xE000;
const BMP_PUA_END = 0xF8FF;

// document information
const TABLE_PAGE_START = 13;
const TABLE_PAGE_END = 267;

// document item transformation comparison precision
const TRANSFORM_EQUAL_RANGE = 0.01;
const ENTRY_BORDER_PRECISION = 4;
const ENTRY_OFFSET_PRECISION = 2;
// using "ucs2" field header as base point for relative table positions
const BASE_POSITION_HEADER_FIELDNAME = 'ucs2';
const HEADER_FIELDNAME_FONT = ['g_d0_f1', 'g_d0_f2'];
const TABLE_OFFSET_X = 0;
const TABLE_OFFSET_Y = 18.72;
const TABLE_SIZE_X = 134.76;
const TABLE_SIZE_Y = 19.7999;


// data output fields
const ENTRYDATA_FIELDNAMES = [
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

// document field headers
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


// offsets for table entry data items
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


const PATTERN_JYUTPING = /^(?<initial>m|n|ng|b|d|g|gw|p|t|k|kw|z|c|f|s|h|l|j|w)?(?<nucleus>aa|a|e|oe|eo|o|u|i|yu|m|ng)(?<coda>i|u|m|n|ng|p|t|k)?(?<tone>[1-6])$/;

const FIELD_PATTERNS = {
	'ucs2' : /^[0-9A-F]{4}$/,
	'ch'   : /^.{1}$/,
	'typ'  : /^([<#>S\$]|\*{1,4})(;([<#>S\$]|\*{1,4}))*$/,
	'rg'   : /^(1|2|3)$/,
	'rad'  : /^部$/,
	'ref1' : /^.{1}$/,
	'ref2' : /^[0-9A-F]{4}$/,
	'en'   : /^(t|s)$/,
	'pn'   : /^1?\d$/,
	'jyutping' : /^[a-z]+\d{1}(\s[a-z]+\d{1})*$/,
	'cl'   : /^又$/,
	'sc'   : /^(1|2|3)(.\d)?$/,
	// 'jyutping' : /^[a-z]+\d{1}$/,
}
function ValidateData(str, type) {
	return ( FIELD_PATTERNS[type] && FIELD_PATTERNS[type].test(str) );
}


// for cases with multiple fields in one document page item
const FIELD_PATTERNS_ALT ={
	'en pn': /^(t|s)\s1?\d$/,
	'ref2 ref2': /^[0-9A-F]{4}\s[0-9A-F]{4}$/,
};
function ValidateDataAlt(str, type) {
	return ( FIELD_PATTERNS_ALT[type] && FIELD_PATTERNS_ALT[type].test(str) );
}

async function ParsePDF(pdf) {
	// ParsePDFTest.pdf = pdf;

	let getpageTasks = [];
	for (let pageNumber = TABLE_PAGE_START; pageNumber <= TABLE_PAGE_END; pageNumber++) {
		if (pageNumber > 0 && pageNumber <= pdf.numPages) {
			getpageTasks.push(pdf.getPage(pageNumber));
		}
	}

	const result = await Promise.all(getpageTasks).then( async (pages) => {
		console.log('Page loading completed.  Parsing pages...');

		ParsePDFTest.pages = [];
		let pageCount = 0;
		let entryCount = 0;

		let parsepageTasks = [];
		pages.forEach( page => parsepageTasks.push(ParsePage(page)) );
		const parseResult = await Promise.all(parsepageTasks).then( (parsedPages) => {
			parsedPages.forEach(pageData => {
				if (pageData && pageData.pageNumber && pageData.entryCount) {
					ParsePDFTest.pages[pageData.pageNumber] = pageData;
					entryCount += pageData.entryCount;
					pageCount++;
				}
			});
			console.log(`Page parsing completed with ${pageCount} pages and ${entryCount} entries.`);

			ParsePDFTest.endTime = Date.now();
			let dataTSV = GetDataTSV(ParsePDFTest.pages);
			let tsvFrame = document.createElement('pre');
			tsvFrame.textContent = dataTSV;
			document.getElementById('file-input-button').remove();
			document.getElementById('content').appendChild(tsvFrame);

		}).catch(error  => {console.log('Page parsing failed.', error);});

	}).catch(error  => {console.log('Page loading failed.', error);});
}


async function ParsePage(page) {
	const pageNumber = page.pageNumber;

	const textContent = await page.getTextContent();

	// get all x,y values, and base header x,y coordinate
	let tValuesX = [];
	let tValuesY = [];
	let tBaseHeaderX = null;
	let tBaseHeaderY = null;
	textContent.items.forEach(item => {
		let text = item.str.trim();
		let fontName = item.fontName;
		let coordX = item.transform[4];
		let coordY = item.transform[5];
		if ( text == '') { return; }
		if ( !( HEADER_FIELDNAME_FONT.includes(fontName) && PAGE_FIELD_HEADERS.includes(text) ) ) {
			// item is not a field header
			if ( !tValuesX.includes(coordX)) { tValuesX.push(coordX); }
			if ( !tValuesY.includes(coordY)) { tValuesY.push(coordY); }
		} else if ( HEADER_FIELDNAME_FONT.includes(fontName) && text == BASE_POSITION_HEADER_FIELDNAME ) {
			// item is a field header, and also the relative position header
			tBaseHeaderX = coordX;
			tBaseHeaderY = coordY;
		}
	});
	tValuesX = tValuesX.sort(floatSort);
	tValuesY = tValuesY.sort(floatSort).reverse();

	// calculate table entry x borders
	let startX = tBaseHeaderX + TABLE_OFFSET_X + TABLE_SIZE_X;
	let tBordersX = [roundDecimal(tBaseHeaderX + TABLE_OFFSET_X, ENTRY_BORDER_PRECISION)];
	tValuesX.forEach((curX) => {
		if ( Math.abs(startX - curX) <= TRANSFORM_EQUAL_RANGE || curX > startX ) {
			tBordersX.push(roundDecimal(startX, ENTRY_BORDER_PRECISION));
			startX += TABLE_SIZE_X;
		}
	});
	tBordersX.push(roundDecimal(startX, ENTRY_BORDER_PRECISION));

	// calculate table entry y borders
	let startY = tBaseHeaderY - TABLE_OFFSET_Y - TABLE_SIZE_Y;
	let tBordersY = [roundDecimal(tBaseHeaderY - TABLE_OFFSET_Y, ENTRY_BORDER_PRECISION)];
	tValuesY.forEach((curY) => {
		if ( Math.abs(startY - curY) <= TRANSFORM_EQUAL_RANGE || curY < startY ) {
			tBordersY.push(roundDecimal(startY, ENTRY_BORDER_PRECISION));
			startY -= TABLE_SIZE_Y;
		}
	});
	tBordersY.push(roundDecimal(startY, ENTRY_BORDER_PRECISION));

	// place items in entry grid sections
	function getEntryGridX(coord, borders) {
		for (let i = 0; i < borders.length - 1; i++) {
			let start = borders[i];
			let end = borders[i + 1];
			if ( (Math.abs(coord - start) <= TRANSFORM_EQUAL_RANGE || coord > start) && (coord < end) ) {
				return i;
			}
		}
	}

	function getEntryGridY(coord, borders) {
		for (let i = 0; i < borders.length - 1; i++) {
			let start = borders[i];
			let end = borders[i + 1];
			if ( (Math.abs(coord - start) <= TRANSFORM_EQUAL_RANGE || coord < start) && (coord > end) ) {
				return i;
			}
		}
	}

	let pageItems = [];
	textContent.items.forEach((item) => {
		let text = item.str.trim();
		if ( text != '' && !(item.fontName == 'g_d0_f1' && PAGE_FIELD_HEADERS.includes(text)) ) {
			let coordX = item.transform[4];
			let coordY = item.transform[5];

			let gridX = getEntryGridX(coordX, tBordersX);
			let gridY = getEntryGridY(coordY, tBordersY);

			if (gridX !== null && gridY !== null) {
				if (pageItems[gridX] === undefined) { pageItems[gridX] = []; }
				if (pageItems[gridX][gridY] === undefined) { pageItems[gridX][gridY] = []; }
				pageItems[gridX][gridY].push(item);
			}
		}
	});

	// identify items by relative position
	function IdentifyItem(item, entryX, entryY, col, row) {
		let type;
		const itemX = item.transform[4];
		const itemY = item.transform[5];
		const itemOffsetX = (itemX - entryX).toFixed(ENTRY_OFFSET_PRECISION);
		const itemOffsetY = Math.abs(itemY - entryY).toFixed(ENTRY_OFFSET_PRECISION);

		// identify field by x offset
		type = FIELD_OFFSET_X[itemOffsetX];
		// check matches for multiple fields, identify by y offset
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

		// if not at standard offset, check 'ref' y offset
		if (type === undefined) {
			if (itemOffsetY == FIELD_OFFSET_Y['ref1'] ) { type = 'ref1'; }
			if (itemOffsetY == FIELD_OFFSET_Y['ref2'] ) { type = 'ref2'; }
		}

		// validate single fields
		let isValid = ValidateData(item.str, type);
		// if not valid, check multi-fields
		if ( !isValid && ValidateDataAlt(item.str, 'en pn') ) { type = 'en pn'; isValid = true; }
		if ( !isValid && ValidateDataAlt(item.str, 'ref2 ref2') ) { type = 'ref2 ref2'; isValid = true; }
		!isValid && console.warn(`Field value pattern is not valid: p:${pageNumber}, x:${col}, y:${row}, type:${type}, str:"${item.str}", item, pageEntries[x][y]`);

		return type;
	}

	// split single 'en pn' item to separate 'en' and 'pn' items
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

	// sort ref1 data in buffer, based on x position and merge into one 'ref1' item
	function FixREF1FieldData(entryNodeData) {
		let isValid = true;
		let coordXBuffer = {};
		entryNodeData['ref1_buf'].forEach(item => {
			let coordX = item.transform[4].toFixed(ENTRY_OFFSET_PRECISION);
			if (coordXBuffer[coordX] === undefined) {
				coordXBuffer[coordX] = item;
			} else {
				isValid = false;
				return;
			}
		});

		let keys = Object.keys(coordXBuffer).sort(floatSort);
		let mergedValue = '';
		keys.forEach(key => {
			if ( ValidateData(coordXBuffer[key].str, 'ref1') ) {
				mergedValue += coordXBuffer[key].str + ' ';
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

	// sort ref2 data in buffer, based on x position and merge into one 'ref1' item
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

		let coordXBuffer = {};
		mergedBuffer.forEach(item => {
			let coordX = item.transform[4].toFixed(ENTRY_OFFSET_PRECISION);
			if (coordXBuffer[coordX] === undefined) {
				coordXBuffer[coordX] = item;
			} else {
				isValid = false;
				return;
			}
		});

		let keys = Object.keys(coordXBuffer).sort(floatSort);
		let mergedValue = '';
		keys.forEach(key => {
			if ( ValidateData(coordXBuffer[key].str, 'ref2') || ValidateDataAlt(coordXBuffer[key].str, 'ref2 ref2')) {
				mergedValue += coordXBuffer[key].str + ' ';
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

	// compile page data into columns > entries
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
					'tX': tBordersX[x],
					'tY': tBordersY[y],
				};
			}
			entryCount += 1;
			
			items.forEach(item => {
				let type = IdentifyItem(item, tBordersX[x], tBordersY[y], x, y);
				if (type == null || type === undefined) {
					console.warn(`Unable to determine field type: Page:${pageNumber}; x:${x}; y:${y}; str:"${item.str}"; ${item}`);
				} else {
					// collect 'ref', 'ref2' data into buffers
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
			// merge data in 'ref' buffers, 'ref2' buffers
			if (pageEntries[x][y].data['ref2_buf'] || pageEntries[x][y].data['ref2 ref2_buf']) {
				let isFixed = FixREF2FieldData(pageEntries[x][y].data);
				!isFixed && console.warn(`Data fix: Page:${pageNumber}; x:${x}; y:${y}; str:"${pageEntries[x][y].data['ref2']}"; isFixed: ${isFixed};`, pageEntries[x][y].data);
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


function GetDataTSV(pages) {
	let dataRows = '';
	let entryNumber = 1;
	let pageCount = 0;
	pages.forEach(page => {
		let pageNumber = page.pageNumber;
		let entries = page.entries;
		let pageEntryNumber = 1;
		pageCount++;

		entries.forEach( (column, indexX) => {
			column.forEach( (entry, indexY) => {
				let entryRow = `${entryNumber}\t${pageNumber}\t${pageEntryNumber}\t${indexX+1}\t${indexY+1}\t`;
				ENTRYDATA_FIELDNAMES.forEach(fieldName => {
					entryRow += ( (entry.data[fieldName] !== undefined && entry.data[fieldName]) || '' ) + '\t';
				});
				dataRows += entryRow.trim() + '\n';

				pageEntryNumber++;
				entryNumber++;
			});
		});
	});

	let headerText = '# ' + new Date(ParsePDFTest.startTime).toString() + '\n';
	headerText += '# ' + (ParsePDFTest.endTime - ParsePDFTest.startTime) + 'ms / ' + (Date.now() - ParsePDFTest.endTime) + 'ms\n';
	headerText += `# file: ${ParsePDFTest.sourceFileName} (${ParsePDFTest.sourceFileSize} B)\n`;
	headerText += `# ${pageCount} pages; ${entryNumber} entries\n`;

	let fieldHeader = '# num	page	entry	x	y	';
	ENTRYDATA_FIELDNAMES.forEach(fieldName => {
		fieldHeader += fieldName + '\t';
	});
	fieldHeader = fieldHeader.trim() + '\n';


	return headerText + fieldHeader + dataRows;
}

