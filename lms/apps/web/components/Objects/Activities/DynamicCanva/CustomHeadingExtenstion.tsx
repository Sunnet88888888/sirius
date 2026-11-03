import Heading from '@tiptap/extension-heading'
import { slugify } from './tocHeadings'

// Custom Heading extension that adds IDs. The table of contents gives h1-h3 their final (unique) ids;
// this one only makes h4-h6 and exported HTML linkable.
export const CustomHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: any }) {
    const hasLevel = this.options.levels.includes(node.attrs.level)
    const level = hasLevel ? node.attrs.level : this.options.levels[0]

    const slug = slugify(node.textContent || '')

    return [
      `h${level}`,
      slug ? { ...HTMLAttributes, id: `heading-${slug}` } : HTMLAttributes,
      0,
    ]
  },
})
