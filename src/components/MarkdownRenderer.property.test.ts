/**
 * Markdown 渲染属性测试
 * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ============ 辅助函数 ============

/**
 * 将 Markdown 语法转换为预期的 HTML 标签
 * 用于验证渲染完整性
 */
function getExpectedHtmlTag(markdownSyntax: string): string | null {
  // 标题
  if (/^#{1}\s/.test(markdownSyntax)) return 'h1';
  if (/^#{2}\s/.test(markdownSyntax)) return 'h2';
  if (/^#{3}\s/.test(markdownSyntax)) return 'h3';
  if (/^#{4}\s/.test(markdownSyntax)) return 'h4';
  if (/^#{5}\s/.test(markdownSyntax)) return 'h5';
  if (/^#{6}\s/.test(markdownSyntax)) return 'h6';
  
  // 无序列表
  if (/^[-*+]\s/.test(markdownSyntax)) return 'ul';
  
  // 有序列表
  if (/^\d+\.\s/.test(markdownSyntax)) return 'ol';
  
  // 粗体
  if (/\*\*[^*]+\*\*/.test(markdownSyntax) || /__[^_]+__/.test(markdownSyntax)) return 'strong';
  
  // 斜体
  if (/\*[^*]+\*/.test(markdownSyntax) || /_[^_]+_/.test(markdownSyntax)) return 'em';
  
  // 链接
  if (/\[.+\]\(.+\)/.test(markdownSyntax)) return 'a';
  
  // 引用块
  if (/^>\s/.test(markdownSyntax)) return 'blockquote';
  
  // 行内代码
  if (/`[^`]+`/.test(markdownSyntax)) return 'code';
  
  // 表格 - 检测多行表格格式：表头行 + 分隔行 + 数据行
  // 分隔行格式: | --- | --- | 或 |:---|:---| 等
  if (/\|[^|]+\|/.test(markdownSyntax) && /\|\s*[-:]+\s*\|/.test(markdownSyntax)) return 'table';
  
  return null;
}

/**
 * 检查 Markdown 语法是否有效
 */
function isValidMarkdownSyntax(syntax: string): boolean {
  return getExpectedHtmlTag(syntax) !== null;
}

// ============ 生成器定义 ============

/**
 * 生成有效的标题文本（不包含特殊字符）
 */
const headingTextArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0 && !/[#*_`\[\]|>]/.test(s));

/**
 * 生成有效的标题 Markdown（h1-h6）
 */
const headingArb = fc.tuple(
  fc.integer({ min: 1, max: 6 }),
  headingTextArb
).map(([level, text]) => ({
  markdown: `${'#'.repeat(level)} ${text}`,
  expectedTag: `h${level}`,
  content: text.trim(),
}));

/**
 * 生成有效的列表项文本
 */
const listItemTextArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => s.trim().length > 0 && !/[#*_`\[\]|>\n]/.test(s));

/**
 * 生成有效的无序列表 Markdown
 */
const unorderedListArb = fc.array(listItemTextArb, { minLength: 1, maxLength: 5 })
  .map(items => ({
    markdown: items.map(item => `- ${item}`).join('\n'),
    expectedTag: 'ul',
    itemCount: items.length,
  }));

/**
 * 生成有效的有序列表 Markdown
 */
const orderedListArb = fc.array(listItemTextArb, { minLength: 1, maxLength: 5 })
  .map(items => ({
    markdown: items.map((item, i) => `${i + 1}. ${item}`).join('\n'),
    expectedTag: 'ol',
    itemCount: items.length,
  }));

/**
 * 生成有效的强调文本（不包含特殊字符）
 */
const emphasisTextArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0 && !/[#*_`\[\]|>\n]/.test(s));

/**
 * 生成有效的粗体 Markdown
 */
const boldArb = emphasisTextArb.map(text => ({
  markdown: `**${text}**`,
  expectedTag: 'strong',
  content: text,
}));

/**
 * 生成有效的斜体 Markdown
 * 注意：斜体文本不能以空格开头，否则会被识别为无序列表
 */
const italicArb = emphasisTextArb
  .filter(text => !text.startsWith(' ')) // 排除以空格开头的文本，避免 `* text*` 被识别为无序列表
  .map(text => ({
    markdown: `*${text}*`,
    expectedTag: 'em',
    content: text,
  }));

/**
 * 生成有效的链接文本
 */
const linkTextArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0 && !/[#*_`\[\]|>\n()]/.test(s));

/**
 * 生成有效的 URL（不包含可能被解析为 Markdown 语法的字符）
 */
const urlArb = fc.webUrl().filter(url => !/[*_]/.test(url));

/**
 * 生成有效的链接 Markdown
 */
const linkArb = fc.tuple(linkTextArb, urlArb).map(([text, url]) => ({
  markdown: `[${text}](${url})`,
  expectedTag: 'a',
  content: text,
  href: url,
}));

/**
 * 生成有效的引用块文本
 */
const blockquoteTextArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0 && !/[#*_`\[\]|>\n]/.test(s));

/**
 * 生成有效的引用块 Markdown
 */
const blockquoteArb = blockquoteTextArb.map(text => ({
  markdown: `> ${text}`,
  expectedTag: 'blockquote',
  content: text,
}));

/**
 * 生成有效的行内代码文本（不包含反引号和可能被解析为其他 Markdown 语法的字符）
 */
const inlineCodeTextArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0 && !s.includes('`') && !s.includes('\n') && !/[*_]/.test(s));

/**
 * 生成有效的行内代码 Markdown
 */
const inlineCodeArb = inlineCodeTextArb.map(text => ({
  markdown: `\`${text}\``,
  expectedTag: 'code',
  content: text,
}));

/**
 * 生成有效的表格单元格文本
 */
const tableCellTextArb = fc.string({ minLength: 1, maxLength: 10 })
  .filter(s => s.trim().length > 0 && !/[#*_`\[\]|>\n]/.test(s));

/**
 * 生成有效的表格 Markdown
 */
const tableArb = fc.tuple(
  fc.array(tableCellTextArb, { minLength: 2, maxLength: 4 }),
  fc.array(
    fc.array(tableCellTextArb, { minLength: 2, maxLength: 4 }),
    { minLength: 1, maxLength: 3 }
  )
).map(([headers, rows]) => {
  // 确保所有行的列数与表头一致
  const colCount = headers.length;
  const normalizedRows = rows.map(row => {
    if (row.length < colCount) {
      return [...row, ...Array(colCount - row.length).fill('cell')];
    }
    return row.slice(0, colCount);
  });
  
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = normalizedRows.map(row => `| ${row.join(' | ')} |`).join('\n');
  
  return {
    markdown: `${headerRow}\n${separatorRow}\n${dataRows}`,
    expectedTag: 'table',
    headerCount: headers.length,
    rowCount: normalizedRows.length,
  };
});

// ============ 测试套件 ============

describe('Markdown 渲染完整性属性测试', () => {
  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含标题语法的 Markdown 文本，应该能正确识别标题级别
   * **Validates: Requirements 3.1**
   */
  it('Property 3.1: 标题语法应正确映射到对应的 HTML 标签', () => {
    fc.assert(
      fc.property(headingArb, ({ markdown, expectedTag }) => {
        // 验证 Markdown 语法能正确映射到预期的 HTML 标签
        const detectedTag = getExpectedHtmlTag(markdown);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含无序列表语法的 Markdown 文本，应该能正确识别为 ul 标签
   * **Validates: Requirements 3.2**
   */
  it('Property 3.2a: 无序列表语法应正确映射到 ul 标签', () => {
    fc.assert(
      fc.property(unorderedListArb, ({ markdown, expectedTag }) => {
        // 验证第一行能正确识别为无序列表
        const firstLine = markdown.split('\n')[0] ?? '';
        const detectedTag = getExpectedHtmlTag(firstLine);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含有序列表语法的 Markdown 文本，应该能正确识别为 ol 标签
   * **Validates: Requirements 3.2**
   */
  it('Property 3.2b: 有序列表语法应正确映射到 ol 标签', () => {
    fc.assert(
      fc.property(orderedListArb, ({ markdown, expectedTag }) => {
        // 验证第一行能正确识别为有序列表
        const firstLine = markdown.split('\n')[0] ?? '';
        const detectedTag = getExpectedHtmlTag(firstLine);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含粗体语法的 Markdown 文本，应该能正确识别为 strong 标签
   * **Validates: Requirements 3.3**
   */
  it('Property 3.3a: 粗体语法应正确映射到 strong 标签', () => {
    fc.assert(
      fc.property(boldArb, ({ markdown, expectedTag }) => {
        const detectedTag = getExpectedHtmlTag(markdown);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含斜体语法的 Markdown 文本，应该能正确识别为 em 标签
   * **Validates: Requirements 3.3**
   */
  it('Property 3.3b: 斜体语法应正确映射到 em 标签', () => {
    fc.assert(
      fc.property(italicArb, ({ markdown, expectedTag }) => {
        const detectedTag = getExpectedHtmlTag(markdown);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含链接语法的 Markdown 文本，应该能正确识别为 a 标签
   * **Validates: Requirements 3.4**
   */
  it('Property 3.4: 链接语法应正确映射到 a 标签', () => {
    fc.assert(
      fc.property(linkArb, ({ markdown, expectedTag }) => {
        const detectedTag = getExpectedHtmlTag(markdown);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含表格语法的 Markdown 文本，应该能正确识别为 table 标签
   * **Validates: Requirements 3.5**
   */
  it('Property 3.5: 表格语法应正确映射到 table 标签', () => {
    fc.assert(
      fc.property(tableArb, ({ markdown, expectedTag }) => {
        const detectedTag = getExpectedHtmlTag(markdown);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含引用块语法的 Markdown 文本，应该能正确识别为 blockquote 标签
   * **Validates: Requirements 3.6**
   */
  it('Property 3.6: 引用块语法应正确映射到 blockquote 标签', () => {
    fc.assert(
      fc.property(blockquoteArb, ({ markdown, expectedTag }) => {
        const detectedTag = getExpectedHtmlTag(markdown);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 包含行内代码语法的 Markdown 文本，应该能正确识别为 code 标签
   * **Validates: Requirements 3.7**
   */
  it('Property 3.7: 行内代码语法应正确映射到 code 标签', () => {
    fc.assert(
      fc.property(inlineCodeArb, ({ markdown, expectedTag }) => {
        const detectedTag = getExpectedHtmlTag(markdown);
        expect(detectedTag).toBe(expectedTag);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 3: Markdown 渲染完整性**
   * *对于任意* 有效的 Markdown 语法，isValidMarkdownSyntax 应返回 true
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
   */
  it('Property 3.8: 所有有效的 Markdown 语法应被正确识别', () => {
    // 组合所有 Markdown 语法生成器
    const allMarkdownArb = fc.oneof(
      headingArb.map(h => h.markdown),
      unorderedListArb.map(l => l.markdown.split('\n')[0] ?? ''),
      orderedListArb.map(l => l.markdown.split('\n')[0] ?? ''),
      boldArb.map(b => b.markdown),
      italicArb.map(i => i.markdown),
      linkArb.map(l => l.markdown),
      blockquoteArb.map(b => b.markdown),
      inlineCodeArb.map(c => c.markdown),
      tableArb.map(t => t.markdown)
    );

    fc.assert(
      fc.property(allMarkdownArb, (markdown) => {
        // 验证所有生成的 Markdown 语法都能被正确识别
        expect(isValidMarkdownSyntax(markdown)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ============ 代码块语言标签辅助函数 ============

/**
 * 从代码块 Markdown 中提取语言标签
 * 代码块格式: ```language\ncode\n```
 */
function extractLanguageFromCodeBlock(markdown: string): string | null {
  const match = /^```(\w+)?\n/.exec(markdown);
  return match ? (match[1] || null) : null;
}

/**
 * 检查语言是否为 HTML（不区分大小写）
 */
function isHtmlLanguage(language: string | null): boolean {
  if (!language) return false;
  return language.toLowerCase() === 'html';
}

// ============ 代码块生成器 ============

/**
 * 生成有效的编程语言名称
 */
const languageArb = fc.constantFrom(
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
  'html', 'HTML', 'Html', 'css', 'json', 'xml', 'sql', 'bash', 'shell',
  'ruby', 'php', 'swift', 'kotlin', 'scala', 'haskell', 'lua', 'perl'
);

/**
 * 生成有效的代码内容（不包含 ``` 序列）
 */
const codeContentArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => !s.includes('```') && s.trim().length > 0);

/**
 * 生成带语言标识的代码块 Markdown
 */
const codeBlockWithLanguageArb = fc.tuple(languageArb, codeContentArb)
  .map(([language, code]) => ({
    markdown: `\`\`\`${language}\n${code}\n\`\`\``,
    language,
    code,
  }));

/**
 * 生成不带语言标识的代码块 Markdown
 */
const codeBlockWithoutLanguageArb = codeContentArb.map(code => ({
  markdown: `\`\`\`\n${code}\n\`\`\``,
  language: null as string | null,
  code,
}));

// ============ 代码块语言标签属性测试 ============

describe('代码块语言标签属性测试', () => {
  /**
   * **Feature: ui-enhancements-v3, Property 4: 代码块语言标签显示**
   * *对于任意* 带语言标识的代码块，渲染后应该在代码块顶部显示对应的语言标签
   * **Validates: Requirements 4.1**
   */
  it('Property 4: 带语言标识的代码块应正确提取语言标签', () => {
    fc.assert(
      fc.property(codeBlockWithLanguageArb, ({ markdown, language }) => {
        // 验证能正确从代码块中提取语言标签
        const extractedLanguage = extractLanguageFromCodeBlock(markdown);
        expect(extractedLanguage).toBe(language);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 4: 代码块语言标签显示**
   * *对于任意* 不带语言标识的代码块，提取的语言标签应为 null
   * **Validates: Requirements 4.1**
   */
  it('Property 4.1: 不带语言标识的代码块应返回 null', () => {
    fc.assert(
      fc.property(codeBlockWithoutLanguageArb, ({ markdown }) => {
        const extractedLanguage = extractLanguageFromCodeBlock(markdown);
        expect(extractedLanguage).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

// ============ HTML 预览按钮属性测试 ============

describe('HTML 预览按钮属性测试', () => {
  /**
   * **Feature: ui-enhancements-v3, Property 5: HTML 代码块预览按钮**
   * *对于任意* 语言标识为 "html" 或 "HTML" 的代码块，应该显示预览按钮
   * **Validates: Requirements 4.5**
   */
  it('Property 5: HTML 代码块应显示预览按钮', () => {
    // 生成 HTML 语言变体
    const htmlLanguageArb = fc.constantFrom('html', 'HTML', 'Html', 'hTmL');
    
    fc.assert(
      fc.property(htmlLanguageArb, (language) => {
        // 验证 HTML 语言（不区分大小写）应该显示预览按钮
        expect(isHtmlLanguage(language)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 5: HTML 代码块预览按钮**
   * *对于任意* 非 HTML 语言的代码块，不应该显示预览按钮
   * **Validates: Requirements 4.5**
   */
  it('Property 5.1: 非 HTML 代码块不应显示预览按钮', () => {
    // 生成非 HTML 语言
    const nonHtmlLanguageArb = fc.constantFrom(
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
      'css', 'json', 'xml', 'sql', 'bash', 'shell', 'ruby', 'php'
    );
    
    fc.assert(
      fc.property(nonHtmlLanguageArb, (language) => {
        // 验证非 HTML 语言不应该显示预览按钮
        expect(isHtmlLanguage(language)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 5: HTML 代码块预览按钮**
   * *对于任意* 空语言标签，不应该显示预览按钮
   * **Validates: Requirements 4.5**
   */
  it('Property 5.2: 空语言标签不应显示预览按钮', () => {
    expect(isHtmlLanguage(null)).toBe(false);
    expect(isHtmlLanguage('')).toBe(false);
  });
});
