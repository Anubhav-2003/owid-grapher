#! /usr/bin/env jest

import { ColumnTypeNames, OwidTable } from "@ourworldindata/core-table"
import { DownloadModal } from "./DownloadModal"

const getTable = (options: { nonRedistributable: boolean }): OwidTable => {
    return new OwidTable(
        [
            ["entityName", "year", "x", "y"],
            ["usa", 1998, 1, 1],
            ["uk", 1999, 0, 0],
            ["uk", 2000, 0, 0],
            ["uk", 2001, 0, 0],
            ["usa", 2002, 2, 2],
        ],
        [
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
                tolerance: 1,
                nonRedistributable: options.nonRedistributable,
            },
            {
                slug: "y",
                type: ColumnTypeNames.Numeric,
                tolerance: 1,
            },
        ]
    )
}

it("correctly passes non-redistributable flag", () => {
    const tableFalse = getTable({ nonRedistributable: false })
    const viewFalse = new DownloadModal({
        manager: {
            staticSVG: "",
            displaySlug: "",
            table: tableFalse,
            detailRenderers: [],
        },
    })
    expect(viewFalse["nonRedistributable"]).toBeFalsy()

    const tableTrue = getTable({ nonRedistributable: true })
    const viewTrue = new DownloadModal({
        manager: {
            staticSVG: "",
            displaySlug: "",
            table: tableTrue,
            detailRenderers: [],
        },
    })
    expect(viewTrue["nonRedistributable"]).toBeTruthy()
})
