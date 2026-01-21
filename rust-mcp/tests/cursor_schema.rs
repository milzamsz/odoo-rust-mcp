use rust_mcp::mcp::tools::tool_defs;

#[test]
fn cursor_can_parse_tool_schemas() {
    // Cursor is picky about union schemas like anyOf / oneOf / type arrays.
    // We keep tool inputSchema permissive but always with a single `type`.
    let tools = tool_defs(false);
    let s = serde_json::to_string(&tools).expect("serialize tool defs");

    assert!(
        !s.contains("\"anyOf\""),
        "tool schemas contain anyOf which Cursor may not parse"
    );
    assert!(
        !s.contains("\"oneOf\""),
        "tool schemas contain oneOf which Cursor may not parse"
    );
    assert!(
        !s.contains("\"type\":["),
        "tool schemas contain type arrays (nullable union) which Cursor may not parse"
    );
    assert!(
        !s.contains("\"$ref\""),
        "tool schemas contain $ref which Cursor may not parse"
    );
    assert!(
        !s.contains("\"definitions\""),
        "tool schemas contain definitions which Cursor may not parse"
    );
}

