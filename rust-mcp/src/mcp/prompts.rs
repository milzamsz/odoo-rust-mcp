use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_json::json;

#[derive(Debug, Clone)]
pub struct PromptDef {
    pub name: &'static str,
    pub description: &'static str,
    pub content: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    pub name: String,
    pub description: String,
    pub content: String,
}

pub const PROMPTS: &[PromptDef] = &[
    PromptDef {
        name: "odoo_common_models",
        description: "List of commonly used Odoo models",
        content: r#"
# Common Odoo Models (v16-19)

Use when: you need the technical model name for a business concept.

## Sales & CRM
- sale.order — Sales Orders
- sale.order.line — Sales Order Lines
- crm.lead — Leads/Opportunities (type: lead | opportunity)
- crm.team — Sales Teams

## Accounting & Invoicing
- account.move — Invoices, Bills & Journal Entries (move_type: out_invoice, in_invoice, out_refund, in_refund, entry)
- account.move.line — Invoice/Bill/Entry Lines
- account.payment — Payments
- account.journal — Journals
- account.account — Chart of Accounts

## Inventory & Warehouse
- stock.picking — Transfers/Deliveries/Receipts
- stock.move — Stock Moves
- stock.move.line — Detailed Move Lines
- stock.warehouse / stock.location — Warehouses / Locations
- product.product — Products (variants)
- product.template — Product Templates

## Partners & Contacts
- res.partner — Contacts/Customers/Vendors
- res.company / res.users — Companies / Users

## HR
- hr.employee / hr.department — Employees / Departments
- hr.leave / hr.contract — Time Off / Contracts

## Projects
- project.project / project.task / project.task.type — Projects / Tasks / Stages

## Purchase
- purchase.order / purchase.order.line — Purchase Orders / Lines
"#,
    },
    PromptDef {
        name: "odoo_domain_filters",
        description: "Guide for Odoo domain filter syntax (the `domain` arg)",
        content: r#"
# Odoo Domain Filters — the `domain` argument

Use when: building the `domain` for odoo_search, odoo_search_read, odoo_count, or odoo_read_group.

A domain is a list of triplets [field, operator, value] combined with prefix logical operators.

## Comparison Operators
- ['amount_total', '=', 1000] / '!=' / '>' / '>=' / '<' / '<='

## String / Pattern
- ['name', 'like', 'John']   contains, case-sensitive
- ['name', 'ilike', 'john']  contains, case-insensitive (most common)
- ['email', '=like', '%@example.com']  SQL LIKE pattern
- ['name', '=ilike', 'john%']           SQL ILIKE pattern

## Membership
- ['state', 'in', ['draft', 'posted']]
- ['state', 'not in', ['cancel']]
- ['partner_id', 'in', [3, 7, 12]]   (ids for Many2one)

## Logical Operators (prefix / Polish notation)
Default between triplets is AND. '&' AND and '|' OR take the next two items; '!' NOT takes the next one.
- ['&', ['state', '=', 'sale'], ['amount_total', '>', 1000]]
- ['|', ['state', '=', 'draft'], ['state', '=', 'sent']]
- ['!', ['state', '=', 'cancel']]

## Traverse related fields with dotted paths
- ['partner_id.country_id.code', '=', 'US']
- ['order_line.product_id.name', 'ilike', 'laptop']

## Complex Example — confirmed US orders over $1000
[
  '&', ['state', '=', 'sale'],
  '&', ['amount_total', '>', 1000],
       ['partner_id.country_id.code', '=', 'US']
]

Tip: empty domain [] matches all records — always pair it with a limit.
"#,
    },
];

pub fn default_prompts() -> Vec<Prompt> {
    PROMPTS
        .iter()
        .map(|p| Prompt {
            name: p.name.to_string(),
            description: p.description.to_string(),
            content: p.content.to_string(),
        })
        .collect()
}

pub fn list_prompts_result(prompts: &[(String, String)]) -> Value {
    json!({
        "prompts": prompts.iter().map(|(name, description)| json!({
            "name": name,
            "description": description,
        })).collect::<Vec<_>>()
    })
}

pub fn get_prompt_result(prompt: &Prompt) -> Value {
    json!({
        "description": prompt.description,
        "messages": [
            {
                "role": "user",
                "content": {
                    "type": "text",
                    "text": prompt.content
                }
            }
        ]
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_prompts_not_empty() {
        let prompts = default_prompts();
        assert!(!prompts.is_empty());
        assert!(prompts.len() >= 2); // We have at least 2 prompts defined
    }

    #[test]
    fn test_default_prompts_have_content() {
        let prompts = default_prompts();
        for p in prompts {
            assert!(!p.name.is_empty());
            assert!(!p.description.is_empty());
            assert!(!p.content.is_empty());
        }
    }

    #[test]
    fn test_list_prompts_result_format() {
        let prompts = vec![
            ("test_prompt".to_string(), "A test prompt".to_string()),
            ("another".to_string(), "Another prompt".to_string()),
        ];
        let result = list_prompts_result(&prompts);

        assert!(result.is_object());
        let prompts_arr = result["prompts"].as_array().unwrap();
        assert_eq!(prompts_arr.len(), 2);
        assert_eq!(prompts_arr[0]["name"], "test_prompt");
        assert_eq!(prompts_arr[0]["description"], "A test prompt");
    }

    #[test]
    fn test_get_prompt_result_format() {
        let prompt = Prompt {
            name: "test".to_string(),
            description: "Test description".to_string(),
            content: "Test content here".to_string(),
        };
        let result = get_prompt_result(&prompt);

        assert!(result.is_object());
        assert_eq!(result["description"], "Test description");

        let messages = result["messages"].as_array().unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0]["role"], "user");
        assert_eq!(messages[0]["content"]["type"], "text");
        assert_eq!(messages[0]["content"]["text"], "Test content here");
    }

    #[test]
    fn test_prompt_serialization() {
        let prompt = Prompt {
            name: "test".to_string(),
            description: "desc".to_string(),
            content: "content".to_string(),
        };
        let json = serde_json::to_string(&prompt).unwrap();
        let parsed: Prompt = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "test");
        assert_eq!(parsed.description, "desc");
        assert_eq!(parsed.content, "content");
    }

    #[test]
    fn test_prompts_constant_has_odoo_models() {
        let found = PROMPTS.iter().any(|p| p.name == "odoo_common_models");
        assert!(found);
    }

    #[test]
    fn test_prompts_constant_has_domain_filters() {
        let found = PROMPTS.iter().any(|p| p.name == "odoo_domain_filters");
        assert!(found);
    }
}
