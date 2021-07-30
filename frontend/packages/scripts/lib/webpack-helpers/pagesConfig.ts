const fs = require('fs');
const path = require('path');

const ejs = require('ejs');

const templatePath = path.join(__dirname, '../templates');
const sitemapTemplatePath = path.join(templatePath, 'sitemap.ejs');

const sitemapTemplate = ejs.compile(fs.readFileSync(sitemapTemplatePath, 'utf8'), { root: [templatePath], filename: sitemapTemplatePath, outputFunctionName: 'echo' });

import { ConfigPages } from '../config';

export default function pagesConfig(pagesKeys: string[]): ConfigPages {

	const pages: ConfigPages = {};

	if (-1 === pagesKeys.indexOf('sitemap')) {

		pages.sitemap = {
			staticPage: true,
			buildExclude: true,
			title: 'Sitemap',
			filename: 'sitemap.html',
			html: {
				head: {},
				body: {
					scripts: [],
					snippet: sitemapTemplate({ pages: [...pagesKeys, ...Object.keys(pages)] }),
				},
			},
			window: {},
			render: ''
		};
	}

	return pages;
}