const { v4: uuidv4 } = require('uuid');

/**
 * MINIMAL WEBFLOW-COMPATIBLE JSON
 * Exactly mirrors the structure from a real Webflow export
 */

function generateMinimalWorkingJson() {
    // Generate all IDs upfront
    const sectionId = uuidv4();
    const containerStyleId = uuidv4();
    const containerId = uuidv4();
    const headingId = uuidv4();
    const headingTextId = uuidv4();
    const sectionStyleId = uuidv4();

    const payload = {
        "type": "@webflow/XscpData",
        "payload": {
            "nodes": [
                // Section (root element)
                {
                    "_id": sectionId,
                    "type": "Section",
                    "tag": "section",
                    "classes": [sectionStyleId],
                    "children": [containerId],
                    "data": {
                        "tag": "section",
                        "devlink": { "runtimeProps": {}, "slot": "" },
                        "displayName": "",
                        "attr": { "id": "" },
                        "xattr": [],
                        "search": { "exclude": false },
                        "visibility": { "conditions": [] },
                        "grid": { "type": "section" }
                    }
                },
                // Container (div)
                {
                    "_id": containerId,
                    "type": "Block",
                    "tag": "div",
                    "classes": [containerStyleId],
                    "children": [headingId],
                    "data": {
                        "text": false,
                        "tag": "div",
                        "devlink": { "runtimeProps": {}, "slot": "" },
                        "displayName": "",
                        "attr": { "id": "" },
                        "xattr": [],
                        "search": { "exclude": false },
                        "visibility": { "conditions": [] }
                    }
                },
                // Heading
                {
                    "_id": headingId,
                    "type": "Heading",
                    "tag": "h2",
                    "classes": [],
                    "children": [headingTextId],
                    "data": {
                        "tag": "h2",
                        "devlink": { "runtimeProps": {}, "slot": "" },
                        "displayName": "",
                        "attr": { "id": "" },
                        "xattr": [],
                        "search": { "exclude": false },
                        "visibility": { "conditions": [] }
                    }
                },
                // Text node (minimal - only _id, text, v)
                {
                    "_id": headingTextId,
                    "text": true,
                    "v": "Hello from Converter Test"
                }
            ],
            "styles": [
                // Section style
                {
                    "_id": sectionStyleId,
                    "fake": false,
                    "type": "class",
                    "name": "section_test",
                    "namespace": "",
                    "comb": "",
                    "styleLess": "",
                    "variants": {},
                    "children": [],
                    "createdBy": "61f14380242f626709f24c30",
                    "origin": null,
                    "selector": null
                },
                // Container style with proper styleLess format
                {
                    "_id": containerStyleId,
                    "fake": false,
                    "type": "class",
                    "name": "container-test",
                    "namespace": "",
                    "comb": "",
                    "styleLess": "max-width: 80rem; margin-right: auto; margin-left: auto; padding-top: 4rem; padding-bottom: 4rem;",
                    "variants": {
                        "medium": { "styleLess": "padding-top: 2rem; padding-bottom: 2rem;" }
                    },
                    "children": [],
                    "createdBy": "61f14380242f626709f24c30",
                    "origin": null,
                    "selector": null
                }
            ],
            "assets": [],
            "ix1": [],
            "ix2": {
                "interactions": [],
                "events": [],
                "actionLists": []
            }
        },
        "meta": {
            "droppedLinks": 0,
            "dynBindRemovedCount": 0,
            "dynListBindRemovedCount": 0,
            "paginationRemovedCount": 0,
            "universalBindingsRemovedCount": 0,
            "unlinkedSymbolCount": 0,
            "codeComponentsRemovedCount": 0
        }
    };

    process.stdout.write(JSON.stringify(payload));
}

generateMinimalWorkingJson();
