
// A simple converter for basic HTML tags to Markdown.
// This can be expanded with a more robust library if needed.
export const htmlToMarkdown = (html: string): string => {
  let markdown = html;

  // Replace paragraphs
  markdown = markdown.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');

  // Replace headings
  markdown = markdown.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n');
  markdown = markdown.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n');
  markdown = markdown.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n');

  // Replace unordered lists
  markdown = markdown.replace(/<ul>/gi, '');
  markdown = markdown.replace(/<\/ul>/gi, '');
  markdown = markdown.replace(/<li>(.*?)<\/li>/gi, '- $1\n');

  // Replace bold/strong
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');

  // Replace italic/em
  markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  
  // Clean up any remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '');

  // Trim whitespace
  return markdown.trim();
};
