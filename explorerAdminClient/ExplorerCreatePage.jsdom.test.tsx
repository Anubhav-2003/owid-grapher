#! /usr/bin/env jest

import React from "react"
import { ExplorerCreatePage } from "./ExplorerCreatePage.js"

import Enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
Enzyme.configure({ adapter: new Adapter() })

describe(ExplorerCreatePage, () => {
    const element = Enzyme.mount(
        <ExplorerCreatePage
            slug={"sample"}
            gitCmsBranchName={"dev"}
            doNotFetch={true}
        />
    )
    it("renders", () => {
        expect(element.find(`.loading-indicator`).length).toEqual(1)
    })

    const explorerCreatePage = element.instance() as ExplorerCreatePage

    it("edit methods work", () => {
        expect(explorerCreatePage.isModified).toEqual(false)
    })
})
