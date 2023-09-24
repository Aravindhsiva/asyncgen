var https = require('https');
var fs = require('fs');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const { Octokit } = require('octokit');
const decompress = require('decompress');
const parser = require('xml2json');
const readline = require('readline');

const octokit = new Octokit({
	auth: '',
});


const initDirectories = () => {
	// Init Zipping Dir
	var dirs = ['out', 'zip'];
	dirs.forEach(dir => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
	});
}
const cleanZipDir = () => {
	fs.rmSync("zip", { recursive: true, force: true });
}

const init = async (req, res) => {
	initDirectories();
	const fileList = ["helloworld.yml"];
	const url = "https://api.asyncapi.com/v1/generate";
	const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
		owner: 'Aravindhsiva',
		repo: 'asyncapi',
		path: fileList[0],
		headers: {
			'X-GitHub-Api-Version': '2022-11-28'
		}
	});
	const outZipName = fileList[0].replace(fileList[0].includes(".yml") ? ".yml" : ".yaml", ".zip");
	const outFileName = outZipName.replace(".zip", ".html");
	const content = Buffer.from(data.content, 'base64').toString();
	const { body } = await fetch(url, {
		method: 'POST',
		body: JSON.stringify({
			"asyncapi": content,
			"template": "@asyncapi/html-template",
			"parameters": {
				"singleFile": "true",
				"outFilename": outFileName
			}
		}),
		headers: {
			'Content-type': 'application/json; charset=UTF-8',
		}
	});
	const stream = fs.createWriteStream('zip/' + outZipName);
	await finished(Readable.fromWeb(body).pipe(stream));
	console.log("Zip Received");

	await decompress('zip/' + outZipName, 'zip');
	console.log('Extraction complete');

	fs.copyFile('zip/template/' + outFileName, 'out/' + outFileName, (err) => {
		if (err) throw err;
		console.log("File Copied");
		cleanZipDir();
	});

};

const listRepo = async () => {

	let repos = await octokit.rest.repos.listForAuthenticatedUser({ visibility: 'all', per_page: 100, affiliation: "owner" });
	repos.data.map(async (d) => {
		const branches = await octokit.rest.repos.listBranches({ owner: "tempuseraccount123", repo: d.name, per_page: 100 });
		console.log("Repo : ", d.name);
		console.log("Total : ", branches.data.map(i => i.name));
	});
}


var download = function (url, dest, cb) {
	var file = fs.createWriteStream(dest);
	https.get(url, function (response) {
		response.pipe(file);
		file.on('finish', function () {
			file.close(cb);
		});
	}).on('error', function (err) {
		fs.unlink(dest);
		if (cb) cb(err.message);
	});
};


async function processPOM() {
	const jar = "commons-collections";
	const toVersion = "9.9.91";
	const versionRegex = /<version>(.*?)<\/version>/g;

	let file = fs.readFileSync("pom.xml", "utf8");
	let arr = file.split(/\r?\n/);
	let lineNo = -1;
	arr.forEach((line, idx) => {
		if (line.includes(jar) && line.includes("artifactId")) {
			lineNo = idx + 1;
		}
	});
	// Finding its version,
	for (var i = lineNo - 1; i <= arr.length; i++) {
		if (arr[i].includes("version")) {
			arr[i] = arr[i].replace(versionRegex, newVersion(toVersion));
			break;
		}
	}
	console.log("success");
	var newFile = fs.createWriteStream('out/pom.xml');
	arr.forEach(function (v) { newFile.write([v].join(', ') + '\n'); });
	newFile.end();
}

newVersion = (version) => `<version>${version}</version>`;

async function processPOMFromGit() {
	const jar = "commons-collections";
	const toVersion = "0.0.3";
	const branchName = "master";
	const versionRegex = /<version>(.*?)<\/version>/g;
	let lineNo;

	const { data: pom } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
		owner: 'Aravindhsiva',
		repo: 'spring-cold-boot',
		path: "pom.xml",
		ref: branchName,
		headers: {
			'X-GitHub-Api-Version': '2022-11-28'
		}
	});
	const pomDataArray = Buffer.from(pom.content, 'base64').toString().split(/\r?\n/);

	pomDataArray.forEach((line, idx) => { if (line.includes(jar) && line.includes("artifactId")) lineNo = idx; });

	if (!lineNo) {
		console.log("Dependency not used in this POM");
		return;
	}

	// Finding its version,
	for (var i = lineNo; i <= pomDataArray.length && lineNo; i++) {
		if (pomDataArray[i].includes("version")) {
			// Replacing old one with new dependency
			pomDataArray[i] = pomDataArray[i].replace(versionRegex, newVersion(toVersion));
			break;
		}
	}

	// Concatinating to string for saving back to Github
	const updatedPom = pomDataArray.join([separator = '\n'])

	// updatePom(updatedPom, jar, toVersion, branchName, pom.sha);
	// Testing the workflow by writing to file
	fs.writeFile('out/pom.xml', updatedPom, (err) => { if (err) throw err; });
	console.log("Updated");
}

const updatePom = async (updatedPom, jarName, version, branchName, sha) => {
	return await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
		owner: 'Aravindhsiva',
		repo: 'spring-cold-boot',
		path: "pom.xml",
		branch: branchName,
		message: `Updating ${jarName} to ${version}`,
		content: Buffer.from(updatedPom, 'utf8').toString('base64'),
		sha: sha
	});
}

processPOMFromGit();







