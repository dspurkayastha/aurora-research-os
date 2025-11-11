/**
 * Document Formatting Utilities for Aurora Research OS
 * 
 * Provides typography, layout, and formatting utilities for professional document generation
 * Following ICH E6(R3) and regulatory standards
 */

export type FontFamily = "Times New Roman" | "Arial" | "Calibri";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface TypographyConfig {
  bodyFont: FontFamily;
  headingFont: FontFamily;
  fontSize: {
    body: number; // points
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
  lineHeight: {
    body: number;
    headings: number;
  };
  margins: {
    top: number; // twips (1/20th of a point, 1440 = 1 inch)
    right: number;
    bottom: number;
    left: number;
  };
  spacing: {
    paragraph: number; // twips
    section: number; // twips
  };
}

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  bodyFont: "Times New Roman",
  headingFont: "Arial",
  fontSize: {
    body: 12,
    h1: 18,
    h2: 16,
    h3: 14,
    h4: 12,
    h5: 11,
    h6: 10,
  },
  lineHeight: {
    body: 1.15,
    headings: 1.2,
  },
  margins: {
    top: 1440, // 1 inch
    right: 1440,
    bottom: 1440,
    left: 1440,
  },
  spacing: {
    paragraph: 240, // ~12pt spacing
    section: 480, // ~24pt spacing before headings
  },
};

/**
 * Escape XML special characters
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a paragraph with formatting
 */
export function buildParagraph(
  text: string,
  config: TypographyConfig = DEFAULT_TYPOGRAPHY,
  options: {
    bold?: boolean;
    italic?: boolean;
    alignment?: "left" | "center" | "right" | "justify";
    spacingBefore?: number;
    spacingAfter?: number;
  } = {}
): string {
  const safe = escapeXml(text);
  const { bold = false, italic = false, alignment = "left", spacingBefore = 0, spacingAfter = config.spacing.paragraph } = options;

  const runProps: string[] = [];
  if (bold) runProps.push(`<w:b/>`);
  if (italic) runProps.push(`<w:i/>`);

  const runPropsXml = runProps.length > 0 ? `<w:rPr>${runProps.join("")}</w:rPr>` : "";

  const paragraphProps: string[] = [];
  if (spacingBefore > 0) {
    paragraphProps.push(`<w:spacing w:before="${spacingBefore}"/>`);
  }
  if (spacingAfter > 0) {
    paragraphProps.push(`<w:spacing w:after="${spacingAfter}"/>`);
  }
  
  const alignmentMap: Record<string, string> = {
    left: "left",
    center: "center",
    right: "right",
    justify: "both",
  };
  if (alignment !== "left") {
    paragraphProps.push(`<w:jc w:val="${alignmentMap[alignment]}"/>`);
  }

  const paragraphPropsXml = paragraphProps.length > 0 ? `<w:pPr>${paragraphProps.join("")}</w:pPr>` : "";

  return `<w:p>${paragraphPropsXml}<w:r><w:rPr><w:rFonts w:ascii="${config.bodyFont}" w:hAnsi="${config.bodyFont}"/><w:sz w:val="${config.fontSize.body * 2}"/></w:rPr>${runPropsXml}<w:t>${safe}</w:t></w:r></w:p>`;
}

/**
 * Build a heading with proper typography hierarchy
 */
export function buildHeading(
  text: string,
  level: HeadingLevel,
  config: TypographyConfig = DEFAULT_TYPOGRAPHY
): string {
  const safe = escapeXml(text);
  const fontSize = config.fontSize[`h${level}` as keyof typeof config.fontSize];
  const spacingBefore = level === 1 ? config.spacing.section : config.spacing.section / 2;
  const spacingAfter = config.spacing.paragraph;

  return `<w:p>
    <w:pPr>
      <w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}"/>
      <w:outlineLvl w:val="${level - 1}"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${config.headingFont}" w:hAnsi="${config.headingFont}"/>
        <w:b/>
        <w:sz w:val="${fontSize * 2}"/>
      </w:rPr>
      <w:t>${safe}</w:t>
    </w:r>
  </w:p>`;
}

/**
 * Build a table with proper formatting
 */
export function buildTable(
  headers: string[],
  rows: string[][],
  config: TypographyConfig = DEFAULT_TYPOGRAPHY,
  options: {
    headerBold?: boolean;
    borders?: boolean;
    alignment?: "left" | "center" | "right";
  } = {}
): string {
  const { headerBold = true, borders = true, alignment = "left" } = options;
  
  const alignmentMap: Record<string, string> = {
    left: "left",
    center: "center",
    right: "right",
  };

  let tableXml = `<w:tbl>
    <w:tblPr>
      <w:tblStyle w:val="TableGrid"/>
      <w:tblW w:w="0" w:type="auto"/>
      ${borders ? `<w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>` : ""}
    </w:tblPr>
    <w:tblGrid>
      ${headers.map(() => `<w:gridCol w:w="2000"/>`).join("")}
    </w:tblGrid>`;

  // Header row
  tableXml += `<w:tr>`;
  for (const header of headers) {
    const safe = escapeXml(header);
    tableXml += `<w:tc>
      <w:tcPr>
        <w:shd w:val="clear" w:color="auto" w:fill="E7E6E6"/>
      </w:tcPr>
      <w:p>
        <w:pPr>
          <w:jc w:val="${alignmentMap[alignment]}"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${config.bodyFont}" w:hAnsi="${config.bodyFont}"/>
            <w:sz w:val="${config.fontSize.body * 2}"/>
            ${headerBold ? `<w:b/>` : ""}
          </w:rPr>
          <w:t>${safe}</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
  }
  tableXml += `</w:tr>`;

  // Data rows
  for (const row of rows) {
    tableXml += `<w:tr>`;
    for (const cell of row) {
      const safe = escapeXml(cell);
      tableXml += `<w:tc>
        <w:tcPr>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="${alignmentMap[alignment]}"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="${config.bodyFont}" w:hAnsi="${config.bodyFont}"/>
              <w:sz w:val="${config.fontSize.body * 2}"/>
            </w:rPr>
            <w:t>${safe}</w:t>
          </w:r>
        </w:p>
      </w:tc>`;
    }
    tableXml += `</w:tr>`;
  }

  tableXml += `</w:tbl>`;
  return tableXml;
}

/**
 * Build a page break
 */
export function buildPageBreak(): string {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
}

/**
 * Build a section break
 */
export function buildSectionBreak(): string {
  return `<w:p><w:pPr><w:sectPr/></w:pPr></w:p>`;
}

/**
 * Build document styles XML (for Word styles)
 */
export function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="480" w:after="240"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="36"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="240" w:after="240"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

