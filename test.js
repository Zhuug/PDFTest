function LoadFile(event) {

	let loadPDF = pdfjsLib.getDocument(event.target.files[0]);
}



window.onload = async function() {
	let contentFrame = document.getElementById('content');
	let fileButton = document.createElement('input');
	fileButton.id = ('file-input-button');
	fileButton.type = 'file';
	fileButton.onchange = LoadFile;
	contentFrame.firstChild && contentFrame.insertBefore(fileButton, contentFrame.firstChild) || contentFrame.appendChild(fileButton);
}
