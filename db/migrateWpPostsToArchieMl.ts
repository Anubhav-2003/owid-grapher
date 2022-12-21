// WIP: Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import _, * as lodash from "lodash"
import * as cheerio from "cheerio"

import {
    EnrichedBlockImage,
    OwidEnrichedArticleBlock,
    EnrichedBlockPullQuote,
    EnrichedBlockText,
    Span,
    SpanSimpleText,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { cheerioToSpan } from "./model/Gdoc/gdocUtils.js"

// Note: all of this code is heavvy WIP - please ignore it for now

// function mapCheerioChildren(
//     node: CheerioElement,
//     handler: (node: CheerioElement) => void
// ): void {
//     node.children?.forEach((child) => {
//         handler(child)
//         mapCheerioChildren(child, handler)
//     })
// }

// TODO: add context for per post stats and error message context

function unwrapNode(
    node: CheerioElement
): ArchieMlTransformationResult<OwidEnrichedArticleBlock> {
    const children = node.children.map(cheerioToArchieML)
    return joinArchieMLTransformationResults(children)
}

type ErrorNames =
    | "blockquote content is not just text"
    | "too many figcaption elements"
    | "too many figcaption elements after archieml transform"
    | "too many figcaption elements after archieml transform"
    | "figcaption element is not structured text"
    | "unkown element tag"

interface ArchieMlTransformationError {
    name: ErrorNames

    details: string
}

interface ArchieMlTransformationResult<T> {
    errors: ArchieMlTransformationError[]
    content: T[]
}

function joinArchieMLTransformationResults<T>(
    results: ArchieMlTransformationResult<T>[]
): ArchieMlTransformationResult<T> {
    const errors = lodash.flatten(results.map((r) => r.errors))
    const content = lodash.flatten(results.map((r) => r.content))
    return { errors, content }
}

function findRecursive(
    nodes: CheerioElement[],
    tagName: string
): CheerioElement | undefined {
    for (const node of nodes) {
        if (node.tagName === tagName) return node
        else {
            const result = findRecursive(node.children ?? [], tagName)
            if (result !== undefined) return result
        }
    }
    return undefined
}

function getSimpleSpans(spans: Span[]): [SpanSimpleText[], Span[]] {
    return _.partition(
        spans,
        (span: Span): span is SpanSimpleText =>
            span.spanType === "span-simple-text"
    )
}

function cheerioToArchieML(
    node: CheerioElement
): ArchieMlTransformationResult<OwidEnrichedArticleBlock> {
    if (node.type === "comment") return { errors: [], content: [] }
    const span = cheerioToSpan(node)
    if (span)
        return {
            errors: [],
            // TODO: below should be a list of spans and a rich text block
            content: [{ type: "text", value: [span], parseErrors: [] }],
        }
    else if (node.type === "tag") {
        const result: ArchieMlTransformationResult<OwidEnrichedArticleBlock> =
            match(node)
                .with({ tagName: "address" }, unwrapNode)
                .with(
                    { tagName: "blockquote" },
                    (): ArchieMlTransformationResult<EnrichedBlockPullQuote> => {
                        const childElements = joinArchieMLTransformationResults(
                            node.children.map(cheerioToArchieML)
                        )
                        // TODO: put this in place again
                        // const cleanedChildElements = consolidateSpans(
                        //     childElements.content
                        // )
                        if (
                            childElements.content.length !== 1 ||
                            childElements.content[0].type !== "text"
                        )
                            return {
                                errors: [
                                    {
                                        name: "blockquote content is not just text",
                                        details: ``,
                                    },
                                ],
                                content: [],
                            }
                        const [simpleSpans, otherSpans] = getSimpleSpans(
                            childElements.content[0].value
                        )

                        return {
                            errors: [],
                            content: [
                                {
                                    type: "pull-quote",
                                    // TODO: this is incomplete - needs to match to all text-ish elements like StructuredText
                                    text: simpleSpans,
                                    parseErrors:
                                        otherSpans.length === 0
                                            ? []
                                            : [
                                                  {
                                                      message:
                                                          "Dropped text fragments that were not just unformatted text",
                                                  },
                                              ],
                                },
                            ],
                        }
                    }
                )
                .with({ tagName: "body" }, unwrapNode)
                .with({ tagName: "center" }, unwrapNode) // might want to translate this to a block with a centered style?
                .with({ tagName: "details" }, unwrapNode)
                .with({ tagName: "div" }, unwrapNode)
                .with({ tagName: "figcaption" }, unwrapNode)
                .with(
                    { tagName: "figure" },
                    (): ArchieMlTransformationResult<EnrichedBlockImage> => {
                        const errors: ArchieMlTransformationError[] = []
                        const [figcaptionChildren, otherChildren] = _.partition(
                            node.children,
                            (n) => n.tagName === "figcaption"
                        )
                        let figcaptionElement: EnrichedBlockText | undefined =
                            undefined
                        if (figcaptionChildren.length > 1) {
                            errors.push({
                                name: "too many figcaption elements",
                                details: `Found ${figcaptionChildren.length} elements`,
                            })
                        } else {
                            const figCaption =
                                figcaptionChildren.length > 0
                                    ? cheerioToArchieML(figcaptionChildren[0])
                                    : undefined
                            if (figCaption)
                                if (figCaption.content.length > 1)
                                    errors.push({
                                        name: "too many figcaption elements after archieml transform",
                                        details: `Found ${figCaption.content.length} elements after transforming to archieml`,
                                    })
                                else {
                                    const element = figCaption.content[0]
                                    if (element?.type === "text")
                                        figcaptionElement = element
                                    else
                                        errors.push({
                                            name: "figcaption element is not structured text",
                                            details: `Found ${element?.type} element after transforming to archieml`,
                                        })
                                }
                        }
                        const image = findRecursive(otherChildren, "img")
                        if (!image) {
                            // TODO: this is a legitimate case, there may be other content in a figure
                            // but for now we treat it as an error and see how often this error happens
                            errors.push({
                                name: "too many figcaption elements after archieml transform",
                                details: `Found ${otherChildren.length} elements`,
                            })
                        }

                        return {
                            errors,
                            content: [
                                {
                                    type: "image",
                                    src: image?.attribs.src ?? "",
                                    caption: figcaptionElement?.value ?? [],
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                // TODO: this is missing a lot of html tags still
                .otherwise(() => ({ errors: [], content: [] }))
        return result
    } else
        return {
            errors: [
                {
                    name: "unkown element tag",
                    details: `type was ${node.type}`,
                },
            ],
            content: [],
        }
}

const migrate = async (): Promise<void> => {
    await db.getConnection()

    const posts: { id: number; content: string }[] = await db.queryMysql(`
        SELECT id, content from posts where type<>'wp_block' limit 1
    `)

    // const tagCounts = new Map<string, number>()

    for (const post of posts) {
        const $: CheerioStatic = cheerio.load(post.content)
        const archieMlBodyElements = $("body")
            .contents()
            .toArray()
            .flatMap(cheerioToArchieML)
        console.log(archieMlBodyElements)
    }

    // const sortedTagCount = _.sortBy(
    //     Array.from(tagCounts.entries()),
    //     ([tag, count]) => tag
    // )
    // for (const [tag, count] of sortedTagCount) {
    //     console.log(`${tag}: ${count}`)
    // }

    await db.closeTypeOrmAndKnexConnections()
}

migrate()
