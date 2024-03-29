import Image, * as EleventyImg from '@11ty/eleventy-img';
import * as htmlmin from 'html-minifier';
import MarkdownIt from 'markdown-it';
import MarkdownItFootnote from 'markdown-it-footnote';
import * as path from 'path';
import { getBannerImageSrc, getSharpOptions } from './utils.js';

const mdLib = MarkdownIt({
  html: true,
  typographer: true,
  linkify: true,
})
  .use(markdownLink)
  .use(MarkdownItFootnote);
mdLib.renderer.rules.footnote_caption = renderFootnoteCaption;

export default (c) => {
  c.addTransform('htmlmin', function (content, outputPath) {
    if (!outputPath.endsWith('.html')) {
      return content;
    }

    return htmlmin.minify(content, {
      useShortDoctype: true,
      removeComments: true,
      collapseWhitespace: true,
      sortAttributes: true,
      sortClassName: true,
    });
  });

  c.addShortcode('image', image);
  c.addShortcode('bannerimage', bannerImage);

  // set instead of amend because we want to use the instance elsewhere.
  c.setLibrary('md', mdLib);
  c.addFilter('markdown', (content) => mdLib.renderInline(content));

  c.addFilter('filteredTags', (collection) => {
    const tagSet = new Set();
    for (const item of collection) {
      (item.data.tags ?? []).forEach((tag) => {
        if (['all', 'posts'].includes(tag)) {
          return;
        }
        tagSet.add(tag);
      });
    }

    return Array.from(tagSet);
  });

  c.addFilter('groupByYear', (collection) => {
    return Array.from(
      Map.groupBy(collection, (item) => item.date.getFullYear()).entries()
    ).toSorted((a, b) => b[0] - a[0]);
  });

  c.addPassthroughCopy('style.css');
  c.addPassthroughCopy({ passthrough: '.' });
  c.addPassthroughCopy({ 'passthrough/img': 'img' });
  c.addWatchTarget('passthrough');

  return {
    dir: {
      input: 'src',
    },
  };
};

function markdownLink(md) {
  md.renderer.rules.link_open = (
    tokens,
    index,
    rendererOptions,
    _,
    renderer
  ) => {
    if (tokens[index].attrGet('href').startsWith('http')) {
      tokens[index].attrSet('target', '_blank');
    }

    return renderer.renderToken(tokens, index, rendererOptions);
  };
}

async function image(
  naiveSrc,
  altOrOptions,
  isFirst = false,
  photoCredit = false,
  width = 768,
  float = false
) {
  const src = path.join(
    naiveSrc[0] === '/'
      ? this.eleventy.directories.input
      : path.dirname(this.page.inputPath),
    naiveSrc
  );
  const outputDir = path.join(this.eleventy.directories.output, 'img');

  const htmlOptions = {};
  let imageData = {};
  if (typeof altOrOptions === 'string') {
    htmlOptions.alt = altOrOptions;
  } else {
    imageData = altOrOptions[path.basename(naiveSrc)];
    htmlOptions.alt = imageData.alt;
  }
  const sharpOptions = getSharpOptions(imageData);

  const metadata = await Image(src, {
    widths: [1, 1.5, 2].map((scale) => width * scale),
    formats: ['avif', 'webp'],
    outputDir,
    ...sharpOptions,
  });

  const pictureElement = EleventyImg.generateHTML(metadata, {
    sizes: 'auto',
    loading: isFirst ? 'eager' : 'lazy',
    decode: 'async',
    ...htmlOptions,
  });

  const className = `image-container ${float || ''}`;

  return `<div class="${className}">${pictureElement}</a>${
    photoCredit ? '<span>Image Credit: ' + photoCredit + '</span>' : ''
  }</div>`;
}

async function bannerImage(post, isFirst = false) {
  const src = await getBannerImageSrc(post, post.data);
  if (!src) {
    return '';
  }

  const outputDir = path.join(post.data.eleventy.directories.output, 'img');
  const metadata = await Image(src, {
    widths: [1, 1.5, 2].map((scale) => 768 * scale),
    formats: ['avif', 'webp'],
    outputDir,
    ...getSharpOptions(post.data.banner_image),
  });

  const pictureElement = EleventyImg.generateHTML(metadata, {
    alt: post.data.banner_image.alt,
    sizes: 'auto',
    loading: isFirst ? 'eager' : 'lazy',
    decode: 'async',
  });
  return `<div class="image image-container"><a href="${post.url}">${pictureElement}</a></div>`;
}

// Copied from https://github.com/markdown-it/markdown-it-footnote/blob/fe6c169c72b9f4d6656b10aa449128456f5a990e/index.mjs#L17C1-L23C2
function renderFootnoteCaption(tokens, idx) {
  let n = Number(tokens[idx].meta.id + 1).toString();
  if (tokens[idx].meta.subId > 0) n += `:${tokens[idx].meta.subId}`;
  return `${n}`;
}
