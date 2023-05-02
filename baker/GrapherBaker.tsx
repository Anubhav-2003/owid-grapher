import React from "react"
import { GrapherPage } from "../site/GrapherPage.js"
import { DataPage } from "../site/DataPage.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    urlToSlug,
    without,
    deserializeJSONFromHTML,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    uniq,
    JsonError,
} from "@ourworldindata/utils"
import {
    getRelatedArticles,
    getRelatedCharts,
    isWordpressAPIEnabled,
    isWordpressDBEnabled,
} from "../db/wpdb.js"
import fs from "fs-extra"
import * as lodash from "lodash"
import { bakeGraphersToPngs } from "./GrapherImageBaker.js"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    MAX_NUM_BAKE_PROCESSES,
    DATA_FILES_CHECKSUMS_DIRECTORY,
    ADMIN_BASE_URL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { glob } from "glob"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import { getPostBySlug } from "../db/model/Post.js"
import {
    GRAPHER_VARIABLES_ROUTE,
    GRAPHER_VARIABLE_DATA_ROUTE,
    GRAPHER_VARIABLE_METADATA_ROUTE,
    getVariableDataRoute,
    getVariableMetadataRoute,
    GrapherInterface,
} from "@ourworldindata/grapher"
import workerpool from "workerpool"
import ProgressBar from "progress"
import { getVariableData } from "../db/model/Variable.js"
import { getDatapageGdoc, getDatapageJson } from "../datapage/Datapage.js"
import { logContentErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"

/**
 *
 * Render a datapage if available, otherwise render a grapher page.
 *
 * Rendering a datapage requires a datapage JSON file to be present in the
 * owid-content repository, and optionally a companion gdoc to be registered in
 * the posts_gdocs table
 */
export const renderDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    isPreviewing: boolean,
    publishedExplorersBySlug?: Record<string, ExplorerProgram>
) => {
    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))
    // this shows that multi-metric charts are not really supported, and will
    // render a datapage corresponding to the first variable found.
    const id = variableIds[0]

    // Get the datapage JSON file from the owid-content git repo that has
    // been updated and pulled separately by an author.
    const { datapageJson, parseErrors } = await getDatapageJson(id)

    // When previewing a datapage we want to show all discrepancies with the
    // expected JSON schema in the browser. When baking, a single error by
    // datapage will be sent to slack while falling back to rendering a regular
    // grapher page.
    if (parseErrors.length > 0) {
        if (isPreviewing) {
            return renderToHtmlPage(
                <pre>{JSON.stringify(parseErrors, null, 2)}</pre>
            )
            // We want to log an error for published data pages. This means we
            // also want to log an error in case we can't parse the JSON and
            // hence don't know if the data page is published or not.
        } else if (
            datapageJson === null ||
            datapageJson.status === "published"
        ) {
            logContentErrorAndMaybeSendToSlack(
                new JsonError(
                    `Data page error in ${id}.json: please check ${ADMIN_BASE_URL}/admin/grapher/${grapher.slug}`
                )
            )
        }
    }

    // Fallback to rendering a regular grapher page whether the datapage JSON
    // wasn't found or failed to parse or if the datapage is not fully
    // configured for publishing yet
    if (
        // This could be folded into the showDataPageOnChartIds check below, but
        // is kept separate to reiterate that that abscence of a datapageJson leads to
        // rendering a grapher page
        !datapageJson ||
        parseErrors.length > 0 ||
        // We only want to render datapages on selected charts, even if the
        // variable found on the chart has a datapage configuration.
        !grapher.id ||
        !datapageJson.showDataPageOnChartIds.includes(grapher.id) ||
        // Fall back to rendering a regular grapher page if the datapage is not
        // published or if we're not previewing
        !(datapageJson.status === "published" || isPreviewing)
    )
        return renderGrapherPage(grapher)

    // Compliment the text-only content from the JSON with rich text from the
    // companion gdoc
    const datapageGdoc = await getDatapageGdoc(
        datapageJson,
        isPreviewing,
        publishedExplorersBySlug
    )

    return renderToHtmlPage(
        <DataPage
            grapher={grapher}
            datapageJson={datapageJson}
            datapageGdoc={datapageGdoc}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
        />
    )
}

const renderGrapherPage = async (grapher: GrapherInterface) => {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug ? await getPostBySlug(postSlug) : undefined
    const relatedCharts =
        post && isWordpressDBEnabled
            ? await getRelatedCharts(post.id)
            : undefined
    const relatedArticles =
        grapher.id && isWordpressAPIEnabled
            ? await getRelatedArticles(grapher.id)
            : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            post={post}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
        />
    )
}

interface BakeVariableDataArguments {
    bakedSiteDir: string
    checksumsDir: string
    variableId: number
}

export const bakeVariableData = async (
    bakeArgs: BakeVariableDataArguments
): Promise<BakeVariableDataArguments> => {
    const { data, metadata } = await getVariableData(bakeArgs.variableId)

    // NOTE: if variable has dataPath (its data exists in S3), we still write the data to disk
    // in the future when all our data lives in S3 we should just pass the link to grapher and
    // let it load the data from S3
    const path = `${bakeArgs.bakedSiteDir}${getVariableDataRoute(
        bakeArgs.variableId
    )}`
    await fs.writeFile(path, JSON.stringify(data))

    const metadataPath = `${bakeArgs.bakedSiteDir}${getVariableMetadataRoute(
        bakeArgs.variableId
    )}`
    await fs.writeFile(metadataPath, JSON.stringify(metadata))

    return bakeArgs
}

const chartIsSameVersion = async (
    htmlPath: string,
    grapherVersion: number | undefined
): Promise<boolean> => {
    if (fs.existsSync(htmlPath)) {
        // If the chart is the same version, we can potentially skip baking the data and exports (which is by far the slowest part)
        const html = await fs.readFile(htmlPath, "utf8")
        const savedVersion = deserializeJSONFromHTML(html)
        return savedVersion?.version === grapherVersion
    } else {
        return false
    }
}

const bakeGrapherPageAndVariablesPngAndSVGIfChanged = async (
    bakedSiteDir: string,
    grapher: GrapherInterface
) => {
    const htmlPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    const isSameVersion = await chartIsSameVersion(htmlPath, grapher.version)

    // Need to set up the connection for using TypeORM in
    // renderDataPageOrGrapherPage() when baking using multiple worker threads
    // (MAX_NUM_BAKE_PROCESSES > 1). It could be done in
    // renderDataPageOrGrapherPage() too, but given that this render function is also used
    // for rendering a datapage preview in the admin where worker threads are
    // not used, lifting the connection set up here seems more appropriate.
    await db.getConnection()

    // Always bake the html for every chart; it's cheap to do so
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(
        outPath,
        await renderDataPageOrGrapherPage(grapher, false)
    )
    console.log(outPath)

    const variableIds = lodash.uniq(
        grapher.dimensions?.map((d) => d.variableId)
    )
    if (!variableIds.length) return

    await fs.mkdirp(`${bakedSiteDir}/grapher/exports/`)
    const svgPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.svg`
    const pngPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.png`
    if (!isSameVersion || !fs.existsSync(svgPath) || !fs.existsSync(pngPath)) {
        const loadDataMetadataPromises: Promise<OwidVariableDataMetadataDimensions>[] =
            variableIds.map(async (variableId) => {
                const metadataPath = `${bakedSiteDir}${getVariableMetadataRoute(
                    variableId
                )}`
                const metadataString = await fs.readFile(metadataPath, "utf8")
                const metadataJson = JSON.parse(
                    metadataString
                ) as OwidVariableWithSourceAndDimension

                const dataPath = `${bakedSiteDir}${getVariableDataRoute(
                    variableId
                )}`
                const dataString = await fs.readFile(dataPath, "utf8")
                const dataJson = JSON.parse(dataString) as OwidVariableMixedData

                return {
                    data: dataJson,
                    metadata: metadataJson,
                }
            })
        const variableDataMetadata = await Promise.all(loadDataMetadataPromises)
        const variableDataMedadataMap = new Map(
            variableDataMetadata.map((item) => [item.metadata.id, item])
        )
        await bakeGraphersToPngs(
            `${bakedSiteDir}/grapher/exports`,
            grapher,
            variableDataMedadataMap,
            OPTIMIZE_SVG_EXPORTS
        )
    }
}

const deleteOldGraphers = async (bakedSiteDir: string, newSlugs: string[]) => {
    // Delete any that are missing from the database
    const oldSlugs = glob
        .sync(`${bakedSiteDir}/grapher/*.html`)
        .map((slug) =>
            slug.replace(`${bakedSiteDir}/grapher/`, "").replace(".html", "")
        )
    const toRemove = without(oldSlugs, ...newSlugs)
        // do not delete grapher slugs redirected to explorers
        .filter((slug) => !isPathRedirectedToExplorer(`/grapher/${slug}`))
    for (const slug of toRemove) {
        console.log(`DELETING ${slug}`)
        try {
            const paths = [
                `${bakedSiteDir}/grapher/${slug}.html`,
                `${bakedSiteDir}/grapher/exports/${slug}.png`,
            ] //, `${BAKED_SITE_DIR}/grapher/exports/${slug}.svg`]
            await Promise.all(paths.map((p) => fs.unlink(p)))
            paths.map((p) => console.log(p))
        } catch (err) {
            console.error(err)
        }
    }
}

export const bakeAllPublishedChartsVariableDataAndMetadata = async (
    bakedSiteDir: string,
    variableIds: number[],
    checksumsDir: string
) => {
    await fs.mkdirp(`${bakedSiteDir}${GRAPHER_VARIABLES_ROUTE}`)
    await fs.mkdirp(`${bakedSiteDir}${GRAPHER_VARIABLE_DATA_ROUTE}`)
    await fs.mkdirp(`${bakedSiteDir}${GRAPHER_VARIABLE_METADATA_ROUTE}`)
    await fs.mkdirp(checksumsDir)

    const progressBar = new ProgressBar(
        "bake variable data/metadata json [:bar] :current/:total :elapseds :rate/s :etas :name\n",
        {
            width: 20,
            total: variableIds.length + 1,
        }
    )

    const jobs: BakeVariableDataArguments[] = variableIds.map((variableId) => ({
        bakedSiteDir,
        variableId,
        checksumsDir,
    }))

    await Promise.all(
        jobs.map(async (job) => {
            await bakeVariableData(job)
            progressBar.tick({ name: `variableid ${job.variableId}` })
        })
    )
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
    slug: string
}

export const bakeSingleGrapherChart = async (
    args: BakeSingleGrapherChartArguments
) => {
    const grapher: GrapherInterface = JSON.parse(args.config)
    grapher.id = args.id

    // Avoid baking paths that have an Explorer redirect.
    // Redirects take precedence.
    if (isPathRedirectedToExplorer(`/grapher/${grapher.slug}`)) {
        console.log(`⏩ ${grapher.slug} redirects to explorer`)
        return
    }

    await bakeGrapherPageAndVariablesPngAndSVGIfChanged(
        args.bakedSiteDir,
        grapher
    )
    return args
}

export const bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers =
    async (bakedSiteDir: string) => {
        const variablesToBake: { varId: number }[] =
            await db.queryMysql(`select distinct vars.varID as varId
            from
            charts c,
            json_table(c.config, '$.dimensions[*]' columns (varID integer path '$.variableId') ) as vars
            where JSON_EXTRACT(c.config, '$.isPublished')=true`)

        await bakeAllPublishedChartsVariableDataAndMetadata(
            bakedSiteDir,
            variablesToBake.map((v) => v.varId),
            DATA_FILES_CHECKSUMS_DIRECTORY
        )

        const rows: { id: number; config: string; slug: string }[] =
            await db.queryMysql(`
                SELECT
                    id, config, config->>'$.slug' as slug
                FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true
                ORDER BY JSON_EXTRACT(config, "$.slug") ASC
                `)

        const newSlugs = rows.map((row) => row.slug)
        await fs.mkdirp(bakedSiteDir + "/grapher")
        const jobs: BakeSingleGrapherChartArguments[] = rows.map((row) => ({
            id: row.id,
            config: row.config,
            bakedSiteDir: bakedSiteDir,
            slug: row.slug,
        }))

        const progressBar = new ProgressBar(
            "bake grapher page [:bar] :current/:total :elapseds :rate/s :etas :name\n",
            {
                width: 20,
                total: rows.length + 1,
            }
        )

        if (MAX_NUM_BAKE_PROCESSES == 1) {
            await Promise.all(
                jobs.map(async (job) => {
                    await bakeSingleGrapherChart(job)
                    progressBar.tick({ name: `slug ${job.slug}` })
                })
            )
        } else {
            const poolOptions = {
                minWorkers: 2,
                maxWorkers: MAX_NUM_BAKE_PROCESSES,
            }
            const pool = workerpool.pool(__dirname + "/worker.js", poolOptions)
            try {
                await Promise.all(
                    jobs.map((job) =>
                        pool.exec("bakeSingleGrapherChart", [job]).then(() =>
                            progressBar.tick({
                                name: `Baked chart ${job.slug}`,
                            })
                        )
                    )
                )
            } finally {
                await pool.terminate(true)
            }
        }

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        progressBar.tick({ name: `✅ Deleted old graphers` })
    }
