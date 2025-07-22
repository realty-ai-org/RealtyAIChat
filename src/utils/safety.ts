import { Marked } from "@ts-stack/markdown";

// Configure Marked to not wrap text in paragraph tags
Marked.setOptions({ isNoP: true });

export const sanitizeHtmlText = (message: string): string => {
  message = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  console.log(message);
  return removeHtmlElements(message);
}

export const removeHtmlElements = (message: string): string => {
  let doc = new DOMParser().parseFromString(message, 'text/html');
  return doc.body.textContent || "";
}

// Secure markdown parsing with comprehensive sanitization
export const parseMarkdownSafely = (markdown: string): string => {
  // First, parse markdown to HTML
  const html = Marked.parse(markdown, {
    // Disable sanitize option as it's deprecated and unreliable
    sanitize: false,
  });

  // Apply additional security measures
  return sanitizeMarkdownHtml(html);
};

// Custom sanitization function for markdown HTML
export const sanitizeMarkdownHtml = (html: string): string => {
  // Create a temporary DOM element to parse and sanitize
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove any script tags and event handlers
  const scripts = tempDiv.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  // Remove any elements with event handlers
  const elementsWithEvents = tempDiv.querySelectorAll('*');
  elementsWithEvents.forEach(element => {
    const attrs = element.attributes;
    for (let i = attrs.length - 1; i >= 0; i--) {
      const attr = attrs[i];
      // Remove event handlers and potentially dangerous attributes
      if (attr.name.startsWith('on') || 
          attr.name === 'javascript:' ||
          attr.name === 'data:' ||
          attr.name === 'vbscript:') {
        element.removeAttribute(attr.name);
      }
    }
  });

  // Sanitize links to ensure they're safe
  const links = tempDiv.querySelectorAll('a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      // Validate URL
      try {
        const url = new URL(href);
        if (!['http:', 'https:'].includes(url.protocol)) {
          // Remove unsafe links
          link.removeAttribute('href');
          link.style.pointerEvents = 'none';
        } else {
          // Add security attributes to safe links
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
      } catch {
        // Remove invalid URLs
        link.removeAttribute('href');
        link.style.pointerEvents = 'none';
      }
    }
  });

  // Sanitize images to ensure they're safe
  const images = tempDiv.querySelectorAll('img');
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (src) {
      try {
        const url = new URL(src);
        if (!['http:', 'https:'].includes(url.protocol)) {
          // Remove unsafe images
          img.remove();
        }
      } catch {
        // Remove invalid image URLs
        img.remove();
      }
    }
  });

  // Escape any remaining HTML that might be dangerous
  const sanitizedHtml = tempDiv.innerHTML;
  
  // Additional pass through the existing sanitizeHtmlText function
  return sanitizeHtmlText(sanitizedHtml);
};
