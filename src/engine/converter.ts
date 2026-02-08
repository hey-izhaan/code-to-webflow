import { v4 as uuidv4 } from 'uuid';
import type { WebflowClipboardData, WebflowNode, WebflowStyle } from './types';

// HTML tag to Webflow type mapping
const TAG_MAP: Record<string, string> = {
    'div': 'Block',
    'section': 'Section',
    'header': 'Block',
    'footer': 'Block',
    'main': 'Block',
    'article': 'Block',
    'aside': 'Block',
    'nav': 'Block',
    'h1': 'Heading',
    'h2': 'Heading',
    'h3': 'Heading',
    'h4': 'Heading',
    'h5': 'Heading',
    'h6': 'Heading',
    'p': 'Paragraph',
    'a': 'Link',
    'span': 'Block',
    'img': 'Image',
    'ul': 'List',
    'ol': 'List',
    'li': 'ListItem',
    'strong': 'Strong',
    'b': 'Strong',
    'em': 'Emphasized',
    'i': 'Emphasized',
    'blockquote': 'Blockquote',
    'figure': 'Figure',
    'figcaption': 'Figcaption',
    'button': 'Block',
    'form': 'Block',
    'input': 'Block',
    'label': 'Block',
    'textarea': 'Block',
    'select': 'Block',
};

// Tags to completely ignore during conversion
const IGNORED_TAGS = new Set([
    'html',
    'head',
    'body',
    'meta',
    'link',
    'title',
    'base',
    'noscript',
    'template',
    'slot',
    'doctype',
    '!doctype',
    'colgroup',
    'col',
    'caption',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'br',
    'hr',
    'wbr',
    'area',
    'map',
    'track',
    'source',
    'param',
    'object',
    'embed',
    'portal',
    'picture', // We'll handle img inside picture separately
]);

// Parse CSS variables from :root or other selectors
function parseCssVariables(css: string): Map<string, string> {
    const variables = new Map<string, string>();

    // Match :root { ... } or similar blocks with CSS variables
    const rootRegex = /:root\s*\{([^}]+)\}/g;
    let match;

    while ((match = rootRegex.exec(css)) !== null) {
        const content = match[1];
        // Match --variable-name: value;
        const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
        let varMatch;

        while ((varMatch = varRegex.exec(content)) !== null) {
            variables.set(`--${varMatch[1]}`, varMatch[2].trim());
        }
    }

    return variables;
}

// Wrap complex CSS values (variables, calc, clamp, etc.) in Webflow's @raw<|...|> format
function wrapCssVariables(value: string): string {
    const trimmed = value.trim();
    // Check if value contains CSS variables or complex functions
    if (trimmed.includes('var(--') ||
        trimmed.includes('calc(') ||
        trimmed.includes('clamp(') ||
        trimmed.includes('min(') ||
        trimmed.includes('max(')) {
        // Wrap the entire value in @raw<|...|>
        return `@raw<|${trimmed}|>`;
    }
    return trimmed;
}

// Expand CSS shorthand to long-form properties
function expandShorthand(prop: string, value: string): string {
    const values = value.trim().split(/\s+/);
    let result = '';

    switch (prop) {
        case 'margin':
        case 'padding':
            if (values.length === 1) {
                result = `${prop}-top: ${values[0]}; ${prop}-right: ${values[0]}; ${prop}-bottom: ${values[0]}; ${prop}-left: ${values[0]};`;
            } else if (values.length === 2) {
                result = `${prop}-top: ${values[0]}; ${prop}-right: ${values[1]}; ${prop}-bottom: ${values[0]}; ${prop}-left: ${values[1]};`;
            } else if (values.length === 3) {
                result = `${prop}-top: ${values[0]}; ${prop}-right: ${values[1]}; ${prop}-bottom: ${values[2]}; ${prop}-left: ${values[1]};`;
            } else if (values.length === 4) {
                result = `${prop}-top: ${values[0]}; ${prop}-right: ${values[1]}; ${prop}-bottom: ${values[2]}; ${prop}-left: ${values[3]};`;
            }
            break;

        case 'border-radius':
            if (values.length === 1) {
                result = `border-top-left-radius: ${values[0]}; border-top-right-radius: ${values[0]}; border-bottom-left-radius: ${values[0]}; border-bottom-right-radius: ${values[0]};`;
            } else if (values.length === 2) {
                result = `border-top-left-radius: ${values[0]}; border-top-right-radius: ${values[1]}; border-bottom-right-radius: ${values[0]}; border-bottom-left-radius: ${values[1]};`;
            } else if (values.length === 4) {
                result = `border-top-left-radius: ${values[0]}; border-top-right-radius: ${values[1]}; border-bottom-right-radius: ${values[2]}; border-bottom-left-radius: ${values[3]};`;
            }
            break;

        case 'gap':
            result = `grid-column-gap: ${values[0]}; grid-row-gap: ${values[1] || values[0]};`;
            break;

        case 'background':
            if (value.startsWith('#') || value.startsWith('rgb') || /^[a-z]+$/i.test(value.trim())) {
                result = `background-color: ${value};`;
            } else {
                result = `${prop}: ${value};`;
            }
            break;

        default:
            result = `${prop}: ${value};`;
    }

    return result;
}

// Parse CSS into styleLess strings with shorthand expansion and @raw variable wrapping
function parseCssToStyleLess(css: string): Map<string, string> {
    const styleMap = new Map<string, string>();

    // Remove comments and media queries for processing (they go to custom embed anyway)
    let cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
    cleanCss = cleanCss.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, '');

    // Match CSS rules: selector { properties }
    // Handles classes, IDs, tags, and complex selectors like .hero h1
    const ruleRegex = /([^{}\n@]+)\s*\{([^{}]+)\}/g;
    let match;

    while ((match = ruleRegex.exec(cleanCss)) !== null) {
        const selector = match[1].trim();
        const properties = match[2].trim();

        // Skip at-rules like @keyframes or @font-face that might have slipped through
        if (selector.startsWith('@')) continue;

        // Process each property
        let styleLess = '';
        properties.split(';').forEach(p => {
            const trimmed = p.trim();
            if (!trimmed) return;

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) return;

            const propName = trimmed.substring(0, colonIndex).trim();
            let propValue = trimmed.substring(colonIndex + 1).trim();

            // Wrap CSS variables in @raw<|...|> format for Webflow
            propValue = wrapCssVariables(propValue);

            // Expand shorthands (but handle @raw values specially)
            if (propValue.startsWith('@raw<|')) {
                // Don't expand shorthands for raw values
                styleLess += ` ${propName}: ${propValue};`;
            } else {
                styleLess += ' ' + expandShorthand(propName, propValue);
            }
        });

        if (styleLess.trim()) {
            styleMap.set(selector, styleLess.trim());
        }
    }

    return styleMap;
}

// Extract all advanced CSS that Webflow can't handle natively
// This includes: :root, media queries, attribute selectors, :is(), nested selectors, etc.
function extractAdvancedCss(css: string): string {
    const advancedRules: string[] = [];

    // Keep comments for readability
    const originalCss = css;

    // 1. Extract :root blocks (CSS variables)
    const rootRegex = /:root\s*\{[^}]+\}/g;
    let match;
    while ((match = rootRegex.exec(originalCss)) !== null) {
        advancedRules.push(match[0]);
    }

    // 2. Extract all @media queries (preserve as-is including nested content)
    const mediaRegex = /@media[^{]+\{([\s\S]*?\})\s*\}/g;
    while ((match = mediaRegex.exec(originalCss)) !== null) {
        advancedRules.push(match[0]);
    }

    // 3. Extract attribute selector rules (outside of media queries)
    // Remove media queries first to avoid duplication
    let cssWithoutMedia = originalCss.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, '');

    // Match any selector containing [...]
    const attrSelectorRegex = /([^\{\}@]*\[[^\]]+\][^\{]*)\{([^}]+)\}/g;
    while ((match = attrSelectorRegex.exec(cssWithoutMedia)) !== null) {
        const selector = match[1].trim();
        const properties = match[2];
        // Skip if empty selector
        if (selector) {
            advancedRules.push(`${selector} {\n${properties}\n}`);
        }
    }

    // 4. Extract :is(), :where(), :has(), :not() with complex content (outside media)
    const complexPseudoRegex = /([^\{\}@]*:(?:is|where|has|not)\([^)]+\)[^\{]*)\{([^}]+)\}/g;
    while ((match = complexPseudoRegex.exec(cssWithoutMedia)) !== null) {
        const selector = match[1].trim();
        const properties = match[2];
        // Avoid duplicates (might have been caught by attribute selector regex)
        const rule = `${selector} {\n${properties}\n}`;
        if (!advancedRules.includes(rule) && !selector.includes('[')) {
            advancedRules.push(rule);
        }
    }

    // 5. Extract element/tag selectors (body, html, *, etc.)
    const elementRegex = /(?:^|\n)\s*((?:html|body|\*|:root)[^{]*)\{([^}]+)\}/g;
    while ((match = elementRegex.exec(cssWithoutMedia)) !== null) {
        const selector = match[1].trim();
        const properties = match[2];
        const rule = `${selector} {\n${properties}\n}`;
        if (!advancedRules.some(r => r.includes(selector))) {
            advancedRules.push(rule);
        }
    }

    // 6. Extract keyframes
    const keyframesRegex = /@keyframes\s+[\w-]+\s*\{[\s\S]*?\}\s*\}/g;
    while ((match = keyframesRegex.exec(originalCss)) !== null) {
        advancedRules.push(match[0]);
    }

    // 7. Extract @font-face
    const fontFaceRegex = /@font-face\s*\{[^}]+\}/g;
    while ((match = fontFaceRegex.exec(originalCss)) !== null) {
        advancedRules.push(match[0]);
    }

    // 8. Extract @import
    const importRegex = /@import\s+[^;]+;/g;
    while ((match = importRegex.exec(originalCss)) !== null) {
        advancedRules.push(match[0]);
    }

    return advancedRules.join('\n\n');
}

// Standard HTML attributes that are handled specially (not put in xattr)
const STANDARD_ATTRS = new Set([
    'class',
    'id',
    'style',
    'src',
    'alt',
    'href',
    'target',
    'width',
    'height',
    'loading',
    'type',
    'name',
    'value',
    'placeholder',
    'disabled',
    'readonly',
    'checked',
    'selected',
    'for',
    'action',
    'method',
    'enctype',
    'rel',
    'media',
]);

export class WebflowConverter {
    private nodes: WebflowNode[] = [];
    private styles: WebflowStyle[] = [];
    private styleIdMap: Map<string, string> = new Map();
    private usedClasses: Set<string> = new Set();
    private cssVariables: Map<string, string> = new Map();
    private complexRules: Map<string, string> = new Map(); // selector -> styleLess
    private selectorToClassMap: Map<string, string> = new Map(); // selector -> generatedClassName
    private styleMap: Map<string, WebflowStyle> = new Map(); // id -> WebflowStyle object (for fast lookup)
    private processedMerges: Set<string> = new Set(); // track merged styles to prevent duplication


    constructor() { }

    public convert(html: string, css: string): WebflowClipboardData {
        this.nodes = [];
        this.styles = [];
        this.styleIdMap = new Map();
        this.styleMap = new Map();
        this.processedMerges = new Set();
        this.usedClasses = new Set();


        // Parse CSS variables (still used for extracting to custom embed)
        this.cssVariables = parseCssVariables(css);

        // Parse external CSS with @raw variable wrapping
        const parsedStyles = parseCssToStyleLess(css);

        // Parse HTML to extract inline styles and collect used classes
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract and parse inline <style> tags
        const styleTags = doc.querySelectorAll('style');
        styleTags.forEach(styleTag => {
            const styleContent = styleTag.textContent || '';
            // Also parse variables from inline styles
            const inlineVariables = parseCssVariables(styleContent);
            inlineVariables.forEach((value, key) => {
                this.cssVariables.set(key, value);
            });

            const inlineStyles = parseCssToStyleLess(styleContent);
            inlineStyles.forEach((styleLess, className) => {
                // Merge with external CSS (inline takes precedence)
                if (!parsedStyles.has(className)) {
                    parsedStyles.set(className, styleLess);
                } else {
                    // Append inline styles to external
                    parsedStyles.set(className, parsedStyles.get(className) + ' ' + styleLess);
                }
            });
            // Remove style tag from DOM so it's not processed as an element
            styleTag.remove();
        });

        // Initialize state for this conversion
        this.complexRules = new Map();
        this.selectorToClassMap = new Map();
        const unusedCssRules: string[] = [];

        // First pass: collect all used classes from HTML
        this.collectUsedClasses(doc.body);

        // Process all parsed styles
        parsedStyles.forEach((styleLess, selector) => {
            const isSimpleClass = selector.startsWith('.') && !selector.includes(' ') && !selector.includes('>') && !selector.includes(':') && !selector.includes('[');

            if (isSimpleClass) {
                const className = selector.substring(1);
                // Only create style if the class is actually used in HTML
                if (this.usedClasses.has(className)) {
                    const styleId = uuidv4();
                    this.styleIdMap.set(className, styleId);
                    const newStyle: WebflowStyle = {
                        _id: styleId,
                        fake: false,
                        type: 'class',
                        name: className,
                        namespace: '',
                        comb: '',
                        styleLess: styleLess,
                        variants: {},
                        children: [],
                        createdBy: '61f14380242f626709f24c30',
                        origin: null,
                        selector: null
                    };
                    this.styles.push(newStyle);
                    this.styleMap.set(styleId, newStyle);

                } else {
                    unusedCssRules.push(`${selector} { ${styleLess} }`);
                }
            } else {
                // Tag, combinator, or complex selector
                this.complexRules.set(selector, styleLess);
                const generatedName = this.generateClassNameFromSelector(selector);
                this.selectorToClassMap.set(selector, generatedName);

                const styleId = uuidv4();
                this.styleIdMap.set(generatedName, styleId);
                const newStyle: WebflowStyle = {
                    _id: styleId,
                    fake: false,
                    type: 'class',
                    name: generatedName,
                    namespace: '',
                    comb: '',
                    styleLess: styleLess,
                    variants: {},
                    children: [],
                    createdBy: '61f14380242f626709f24c30',
                    origin: null,
                    selector: null
                };
                this.styles.push(newStyle);
                this.styleMap.set(styleId, newStyle);

            }
        });

        // Extract advanced CSS that Webflow can't handle natively
        // Combine external CSS with inline styles (before they're removed from DOM)
        const combinedCss = css + '\n' + Array.from(doc.querySelectorAll('style'))
            .map(s => s.textContent || '')
            .join('\n');

        // Extract all advanced CSS (variables, media queries, attribute selectors, etc.)
        const advancedCss = extractAdvancedCss(combinedCss);

        // Collect all top-level element children (filter out ignored/empty)
        const topLevelChildren: string[] = [];
        Array.from(doc.body.children).forEach(child => {
            const childId = this.processElement(child as HTMLElement);
            if (childId) {
                topLevelChildren.push(childId);
            }
        });

        // Build advanced CSS content for custom embed
        const advancedCssParts: string[] = [];

        // Add all advanced CSS
        if (advancedCss) {
            advancedCssParts.push(advancedCss);
        }

        // Add unused class rules
        if (unusedCssRules.length > 0) {
            advancedCssParts.push('\n/* Unused Classes */');
            advancedCssParts.push(unusedCssRules.join('\n'));
        }

        // Create custom embed with all advanced CSS
        if (advancedCssParts.length > 0) {
            const advancedCssContent = `<style>\n${advancedCssParts.join('\n')}\n</style>`;
            const embedNode = this.createHtmlEmbed(advancedCssContent, false);
            this.nodes.push(embedNode);
            topLevelChildren.push(embedNode._id);
        }

        // CRITICAL: Webflow requires exactly ONE root node as the FIRST item in the nodes array
        let rootNodeId: string;

        if (topLevelChildren.length === 0) {
            // No content - create an empty block
            const emptyId = uuidv4();
            const emptyNode: WebflowNode = {
                _id: emptyId,
                type: 'Block',
                tag: 'div',
                classes: [],
                children: [],
                data: {
                    text: false,
                    tag: 'div',
                    devlink: { runtimeProps: {}, slot: '' },
                    displayName: '',
                    attr: { id: '' },
                    xattr: [],
                    search: { exclude: false },
                    visibility: { conditions: [] }
                }
            };
            this.nodes.push(emptyNode);
            rootNodeId = emptyId;
        } else if (topLevelChildren.length === 1) {
            // Single root - use it directly
            rootNodeId = topLevelChildren[0];
        } else {
            // Multiple top-level elements - wrap them in a container
            const wrapperId = uuidv4();
            const wrapperNode: WebflowNode = {
                _id: wrapperId,
                type: 'Block',
                tag: 'div',
                classes: [],
                children: topLevelChildren,
                data: {
                    text: false,
                    tag: 'div',
                    devlink: { runtimeProps: {}, slot: '' },
                    displayName: '',
                    attr: { id: '' },
                    xattr: [],
                    search: { exclude: false },
                    visibility: { conditions: [] }
                }
            };
            this.nodes.push(wrapperNode);
            rootNodeId = wrapperId;
        }

        // Reorder nodes so root is FIRST (Webflow requirement)
        const reorderedNodes = this.reorderNodesWithRootFirst(rootNodeId);

        return {
            type: "@webflow/XscpData",
            payload: {
                nodes: reorderedNodes,
                styles: this.styles,
                assets: [],
                ix1: [],
                ix2: { interactions: [], events: [], actionLists: [] }
            },
            meta: {
                droppedLinks: 0,
                dynBindRemovedCount: 0,
                dynListBindRemovedCount: 0,
                paginationRemovedCount: 0,
                universalBindingsRemovedCount: 0,
                unlinkedSymbolCount: 0,
                codeComponentsRemovedCount: 0
            }
        } as WebflowClipboardData;
    }

    // Reorder nodes so root is first, followed by all descendants in tree order
    private reorderNodesWithRootFirst(rootId: string): WebflowNode[] {
        const nodeMap = new Map<string, WebflowNode>();
        this.nodes.forEach(node => nodeMap.set(node._id, node));

        const result: WebflowNode[] = [];
        const visited = new Set<string>();

        const addNodeAndChildren = (id: string) => {
            if (visited.has(id)) return;
            visited.add(id);

            const node = nodeMap.get(id);
            if (!node) return;

            result.push(node);

            // Add children in order
            if (node.children) {
                node.children.forEach(childId => addNodeAndChildren(childId));
            }
        };

        // Start with root
        addNodeAndChildren(rootId);

        // Add any orphan nodes (like unused CSS embeds if they weren't linked)
        this.nodes.forEach(node => {
            if (!visited.has(node._id)) {
                result.push(node);
            }
        });

        return result;
    }

    private collectUsedClasses(element: Element): void {
        const tagName = element.tagName.toLowerCase();

        // Skip ignored tags but still process their children
        if (!IGNORED_TAGS.has(tagName)) {
            element.classList.forEach(className => {
                this.usedClasses.add(className);
            });
        }

        Array.from(element.children).forEach(child => {
            const childTagName = child.tagName.toLowerCase();
            // Skip script, svg, and style tags entirely (they don't contribute classes)
            if (childTagName !== 'script' && childTagName !== 'svg' && childTagName !== 'style') {
                this.collectUsedClasses(child);
            }
        });
    }

    private createHtmlEmbed(content: string, isScript: boolean): WebflowNode {
        return {
            _id: uuidv4(),
            type: 'HtmlEmbed',
            tag: 'div',
            classes: [],
            children: [],
            v: content,
            data: {
                search: { exclude: true },
                embed: {
                    meta: {
                        html: content,
                        div: false,
                        script: isScript,
                        compilable: false,
                        iframe: false
                    },
                    type: 'html'
                },
                insideRTE: false,
                devlink: { runtimeProps: {}, slot: '' },
                displayName: '',
                attr: { id: '' },
                xattr: [],
                visibility: { conditions: [] }
            }
        };
    }

    // Create a DOM node for custom/unknown elements
    private createDomNode(el: HTMLElement, classIds: string[]): WebflowNode {
        const tagName = el.tagName.toLowerCase();

        // Collect all attributes for DOM node
        const attributes: Array<{ name: string, value: string }> = [];
        const xattr: Array<{ name: string, value: string }> = [];

        Array.from(el.attributes).forEach(attr => {
            const attrName = attr.name.toLowerCase();
            if (attrName === 'class') {
                // Skip class attribute, handled separately
                return;
            }

            // All attributes go to DOM attributes
            attributes.push({ name: attr.name, value: attr.value });

            // Custom attributes also go to xattr
            if (attrName.startsWith('data-') ||
                attrName.startsWith('aria-') ||
                !STANDARD_ATTRS.has(attrName)) {
                xattr.push({ name: attr.name, value: attr.value });
            }
        });

        const node: WebflowNode = {
            _id: uuidv4(),
            type: 'DOM',
            tag: 'div',
            classes: classIds,
            children: [],
            data: {
                tag: tagName,
                attributes: attributes,
                devlink: { runtimeProps: {}, slot: '' },
                displayName: '',
                xattr: xattr,
                search: { exclude: false },
                visibility: { conditions: [] }
            }
        };

        // Process children
        Array.from(el.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childId = this.processElement(child as HTMLElement);
                node.children?.push(childId);
            } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                const textId = uuidv4();
                this.nodes.push({
                    _id: textId,
                    text: true,
                    v: child.textContent.trim()
                });
                node.children?.push(textId);
            }
        });

        return node;
    }

    private processElement(el: HTMLElement): string {
        const tagName = el.tagName.toLowerCase();

        // Skip ignored tags - but process their children
        if (IGNORED_TAGS.has(tagName)) {
            // For ignored container tags, process children and return first child's ID or empty wrapper
            const childIds: string[] = [];
            Array.from(el.childNodes).forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const childId = this.processElement(child as HTMLElement);
                    if (childId) {
                        childIds.push(childId);
                    }
                }
            });
            // Return first child ID if any, otherwise create a placeholder
            return childIds[0] || '';
        }

        // Handle script tags - wrap in HtmlEmbed
        if (tagName === 'script') {
            const scriptHtml = el.outerHTML;
            const embedNode = this.createHtmlEmbed(scriptHtml, true);
            this.nodes.push(embedNode);
            return embedNode._id;
        }

        // Handle SVG tags - wrap in HtmlEmbed
        if (tagName === 'svg') {
            const svgHtml = el.outerHTML;
            const embedNode = this.createHtmlEmbed(svgHtml, false);
            this.nodes.push(embedNode);
            return embedNode._id;
        }

        // Get class-based style IDs
        const classIds: string[] = [];
        el.classList.forEach(className => {
            const styleId = this.styleIdMap.get(className);
            if (styleId) {
                classIds.push(styleId);
            }
        });

        // Apply matching complex or tag rules as custom style classes or merge into existing
        this.complexRules.forEach((styleLess, selector) => {
            try {
                if (el.matches(selector)) {
                    // Strategy: If element already has classes, merge logic. If not, add new logic.
                    if (classIds.length > 0) {
                        // MERGE STRATEGY: Apply styles to the first existing class
                        const targetStyleId = classIds[0];
                        const mergeKey = `${targetStyleId}:${selector}`;

                        if (!this.processedMerges.has(mergeKey)) {
                            const styleObj = this.styleMap.get(targetStyleId);
                            if (styleObj) {
                                // Append the style properties
                                // Adding a space for safety
                                styleObj.styleLess += ` ${styleLess}`;
                                this.processedMerges.add(mergeKey);
                            }
                        }
                    } else {
                        // NEW CLASS STRATEGY: Apply the generated custom-styled class
                        const generatedName = this.selectorToClassMap.get(selector);
                        if (generatedName) {
                            const styleId = this.styleIdMap.get(generatedName);
                            if (styleId && !classIds.includes(styleId)) {
                                classIds.push(styleId);
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore invalid selectors (e.g. pseudo-selectors like :hover which el.matches might not like)
            }
        });


        // Check if this is a known element type
        const type = TAG_MAP[tagName];

        // Unknown elements use DOM type
        if (!type) {
            const domNode = this.createDomNode(el, classIds);
            this.nodes.push(domNode);
            return domNode._id;
        }

        const id = uuidv4();

        // Extract custom attributes for xattr (data-*, aria-*, and any non-standard attributes)
        const xattr: Array<{ name: string, value: string }> = [];
        Array.from(el.attributes).forEach(attr => {
            const attrName = attr.name.toLowerCase();
            // Include data-* and aria-* attributes, plus any non-standard attributes
            if (attrName.startsWith('data-') ||
                attrName.startsWith('aria-') ||
                !STANDARD_ATTRS.has(attrName)) {
                xattr.push({ name: attr.name, value: attr.value });
            }
        });

        // Get the ID attribute if present
        const elementId = el.getAttribute('id') || '';

        // Build data object based on element type
        const data: Record<string, unknown> = {
            text: false,
            tag: tagName,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: '',
            attr: { id: elementId },
            xattr: xattr,
            search: { exclude: false },
            visibility: { conditions: [] }
        };

        // Type-specific data
        if (type === 'Section') {
            data.grid = { type: 'section' };
        }

        if (type === 'Link') {
            const linkEl = el as HTMLAnchorElement;
            const href = linkEl.getAttribute('href') || '#';

            // Determine link mode based on href
            let linkMode = 'external';
            if (href.startsWith('#')) {
                linkMode = 'section';
            } else if (href.startsWith('mailto:')) {
                linkMode = 'email';
            } else if (href.startsWith('tel:')) {
                linkMode = 'phone';
            }

            data.link = {
                mode: linkMode,
                href: href,
                target: linkEl.getAttribute('target') || '_self'
            };
            data.button = false;
            data.block = 'inline';
            data.eventIds = []; // Required eventIds array
        }

        if (type === 'Image') {
            const imgEl = el as HTMLImageElement;
            const assetId = uuidv4(); // Generate asset ID for the image

            data.img = {
                id: assetId // Required img.id
            };
            data.srcsetDisabled = false;
            data.sizes = [];
            data.attr = {
                id: '',
                src: imgEl.getAttribute('src') || '',
                alt: imgEl.getAttribute('alt') || '',
                loading: imgEl.getAttribute('loading') || 'lazy',
                width: imgEl.getAttribute('width') || 'auto',
                height: imgEl.getAttribute('height') || 'auto'
            };
        }

        if (type === 'List') {
            data.list = { type: 'list', unstyled: false };
        }

        if (type === 'ListItem') {
            data.list = { type: 'item' };
        }

        // Handle Section special case - needs wrapper container
        if (type === 'Section') {
            const node: WebflowNode = {
                _id: id,
                type,
                tag: tagName,
                classes: classIds,
                children: [],
                data
            };

            // Check if section has direct content children that need wrapping
            const directChildren = Array.from(el.children);
            const hasBlockWrapper = directChildren.some(child => {
                const childTag = child.tagName.toLowerCase();
                return childTag === 'div' && child.classList.contains('container');
            });

            if (!hasBlockWrapper && directChildren.length > 0) {
                // Create a wrapper container for section children
                const wrapperId = uuidv4();
                const wrapperNode: WebflowNode = {
                    _id: wrapperId,
                    type: 'Block',
                    tag: 'div',
                    classes: [],
                    children: [],
                    data: {
                        text: false,
                        tag: 'div',
                        devlink: { runtimeProps: {}, slot: '' },
                        displayName: '',
                        attr: { id: '' },
                        xattr: [],
                        search: { exclude: false },
                        visibility: { conditions: [] }
                    }
                };

                // Process children into the wrapper
                Array.from(el.childNodes).forEach(child => {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const childId = this.processElement(child as HTMLElement);
                        wrapperNode.children?.push(childId);
                    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                        const textId = uuidv4();
                        this.nodes.push({
                            _id: textId,
                            text: true,
                            v: child.textContent.trim()
                        });
                        wrapperNode.children?.push(textId);
                    }
                });

                this.nodes.push(wrapperNode);
                node.children?.push(wrapperId);
            } else {
                // Process children normally
                Array.from(el.childNodes).forEach(child => {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const childId = this.processElement(child as HTMLElement);
                        node.children?.push(childId);
                    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                        const textId = uuidv4();
                        this.nodes.push({
                            _id: textId,
                            text: true,
                            v: child.textContent.trim()
                        });
                        node.children?.push(textId);
                    }
                });
            }

            this.nodes.push(node);
            return id;
        }

        // Regular element processing
        const node: WebflowNode = {
            _id: id,
            type,
            tag: tagName,
            classes: classIds,
            children: [],
            data
        };

        // Process children
        Array.from(el.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childId = this.processElement(child as HTMLElement);
                node.children?.push(childId);
            } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                const textId = uuidv4();
                this.nodes.push({
                    _id: textId,
                    text: true,
                    v: child.textContent.trim()
                });
                node.children?.push(textId);
            }
        });

        this.nodes.push(node);
        return id;
    }

    private generateClassNameFromSelector(selector: string): string {
        // Handle common tag styles specifically
        if (/^[h1-6]$|^p$|^div$|^span$|^a$|^button$|^input$|^section$|^header$|^footer$|^main$|^aside$|^nav$/.test(selector)) {
            return `custom-styled-${selector}`;
        }

        // Slugify the selector for others
        return selector
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // remove special chars
            .trim()
            .replace(/\s+/g, '-') // spaces to hyphen
            .replace(/-+/g, '-') // multiple hyphens to single
            .replace(/^/, 'scoped-style-'); // prefix to avoid collisions
    }
}
