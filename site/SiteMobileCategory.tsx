import React, { useEffect, useRef } from "react"
import { CategoryWithEntries } from "@ourworldindata/utils"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"
import { allTopicsInCategory } from "./SiteNavigationTopics.js"

export const SiteMobileCategory = ({
    category,
    isActive,
    toggleCategory,
}: {
    category: CategoryWithEntries
    isActive: boolean
    toggleCategory: (category: CategoryWithEntries) => void
}) => {
    const categoryRef = useRef<HTMLLIElement>(null)

    useEffect(() => {
        if (isActive && categoryRef.current) {
            categoryRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [isActive])

    return (
        <li
            key={category.slug}
            className="SiteMobileCategory"
            ref={categoryRef}
        >
            <SiteNavigationToggle
                isActive={isActive}
                onToggle={() => toggleCategory(category)}
                dropdown={
                    <ul>
                        {allTopicsInCategory(category).map((topic) => (
                            <SiteNavigationTopic
                                key={topic.slug}
                                topic={topic}
                            />
                        ))}
                    </ul>
                }
                withCaret={true}
            >
                {category.name}
            </SiteNavigationToggle>
        </li>
    )
}
