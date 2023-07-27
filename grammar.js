const PREC = {
  UNARY: 1,
  CAST : 2,
  ELEMENT_ACCESS : 3,
  EMPTY : 3
}

module.exports = grammar({
  name: 'powershell',

  externals: $ => [
    $._statement_terminator
  ],

  extras: $ => [
    $.comment,
    /`?\s/,
    /[\uFEFF\u2060\u200B\u00A0]/
  ],

  conflicts: $ => [
    [$.array_type_name, $.generic_type_name],
    [$._command_argument, $.redirected_file_name],
    [$._literal, $.member_name],
    [$.switch_clause_condition, $._command_argument],
    [$.switch_filename, $._command_argument],
    [$.class_property_definition, $.attribute],
    [$.class_method_definition, $.attribute],
    [$.class_method_definition, $.class_property_definition]
  ],
  
  rules: {

    program: $ => seq(
      optional($.param_block),
      $._statement_list
    ),

    // Comments
    comment: $ => token(
      choice(
        /#[^\n]*/,
        seq(
          "<#",
          repeat(
            choice(
              /[^#`]+/,
              /#+[^>#]/,
              /`.{1}|`\n/
            )
          ),
          /#+>/
        )
      )
    ),

    // Literal

    _literal: $ => choice(
      $.integer_literal,
      $.string_literal,
      $.real_literal
    ),

    // Integer Literals

    integer_literal: $ => choice(
      $.decimal_integer_literal,
      $.hexadecimel_integer_literal
    ),

    decimal_integer_literal: $ => token(seq(
      /[0-9]+/, optional(choice("l", "d")), optional(choice("kb", "mb", "gb", "tb", "pb"))
    )),

    hexadecimel_integer_literal: $ => token(seq(
      "0x", /[0-9a-fA-F]+/, optional("l"), optional(choice("kb", "mb", "gb", "tb", "pb"))
    )),

    // Real Literals

    real_literal: $ => token(choice(
      seq(/[0-9]+\.[0-9]+/, optional(token(seq("e", optional(choice("+", "-")), /[0-9]+/))), optional(choice("kb", "mb", "gb", "tb", "pb"))),
      seq(/\.[0-9]+/, optional(token(seq("e", optional(choice("+", "-")), /[0-9]+/))), optional(choice("kb", "mb", "gb", "tb", "pb"))),
      seq(/[0-9]+/, token(seq("e", optional(choice("+", "-")), /[0-9]+/)), optional(choice("kb", "mb", "gb", "tb", "pb")))
    )),

    // String literal

    string_literal: $ => choice(
      $._expandable_string_literal,
      $._verbatim_string_characters,
      $._expandable_here_string_literal,
      $._verbatim_here_string_characters
    ),

    _expandable_string_literal: $ => seq(
      /\"\s*#*/,  // this is a trick to avoid tree-sitter allowing comment between tokens, as string should be tokenize but powershell allow subexpression inside it...
      repeat(
        choice(
          token.immediate(/[^\$\"`]+/),
          $.variable,
          $.sub_expression,
          token.immediate(/\$(`.{1}|`\n|[\s\\])/),
          token.immediate(/`.{1}|`\n/),
          token.immediate("\"\"")
        )
      ),
      repeat(token.immediate("$")),
      token.immediate("\"")
    ),

    _expandable_here_string_literal: $ => seq(
      /@\" *\n/,
      repeat(
        choice(
          token.immediate(/[^\$\n`]+/),
          $.variable,
          $.sub_expression,
          token.immediate(/\n+[^\"\n]/),
          token.immediate(/\n+\"[^@]/),
          token.immediate("$"),
          token.immediate(/`.{1}|`\n/)
        )
      ),
      token.immediate(/\n+\"@/)
    ),

    _verbatim_string_characters: $ => token(seq(
      "'",
      repeat(
        choice(
          /[^']+/,
          "''"
        )
      ),
      "'"
    )),

    _verbatim_here_string_characters: $ => token(
      seq(
        /@\'\s*\n/,
        repeat(
          choice(
            /[^\n]/,
            /\n+[^\'\n]/,
            /\n\'[^@]/,
          )
        ),
        /\n+\'@/
      )
    ),

    // Simple names
    simple_name: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // Type names
    type_identifier: $ => /[a-zA-Z0-9_]+/,
    
    type_name: $ => choice(
      $.type_identifier,
      seq($.type_name, ".", $.type_identifier )
    ),

    array_type_name: $ => seq($.type_name, "["),
    generic_type_name: $ => seq($.type_name, "["),

    // Operators and punctuators

    assignement_operator: $ => choice(
      "=", "!=", "+=", "*=", "/=", "%="
    ),

    file_redirection_operator: $ => choice(
      ">",  ">>",  "2>",  "2>>",  "3>",  "3>>",  "4>",  "4>>",
      "5>",  "5>>",  "6>",  "6>>",  "*>",  "*>>",  "<"
    ),

    merging_redirection_operator: $ => choice(
      "*>&1",  "2>&1",  "3>&1",  "4>&1",  "5>&1",  "6>&1",
      "*>&2",  "1>&2",  "3>&2",  "4>&2",  "5>&2",  "6>&2"
    ),

    comparison_operator: $ => choice(
      "-as","-ccontains","-ceq",
      "-cge","-cgt","-cle",
      "-clike","-clt","-cmatch",
      "-cne","-cnotcontains","-cnotlike",
      "-cnotmatch","-contains","-creplace",
      "-csplit","-eq" ,"-ge",
      "-gt", "-icontains","-ieq",
      "-ige","-igt", "-ile",
      "-ilike","-ilt","-imatch",
      "-in","-ine","-inotcontains",
      "-inotlike","-inotmatch","-ireplace",
      "-is","-isnot","-isplit",
      "-join","-le","-like",
      "-lt","-match","-ne",
      "-notcontains","-notin","-notlike",
      "-notmatch","-replace","-shl",
      "-shr","-split"
    ),

    format_operator: $ => "-f",

    // Variables

    variable: $ => choice(
      '$$',
      '$^',
      '$?',
      '$_',
      token(seq('$', optional(seq(choice("global:", "local:", "private:", "script:", "using:", "workflow:", /[a-zA-Z0-9_]+/), ":")), /[a-zA-Z0-9_]+/)),
      token(seq('@', optional(seq(choice("global:", "local:", "private:", "script:", "using:", "workflow:", /[a-zA-Z0-9_]+/), ":")), /[a-zA-Z0-9_]+/)),
      $.braced_variable
    ),

    braced_variable: $=> /\${[^}]+}/,

    // Commands
    generic_token: $ => prec.right(
      seq(
        /[^\{\}\(\);\|\&\$\-`"'\s\n]+/,
        repeat(
          choice(
            token.immediate(/[^\{\}\(\);\|\&\$`"'\s\n]+/),
            seq(token.immediate("\""), $._expandable_string_literal_immediate)
          )
        )
      )  
    ),

    // Parameters
    command_parameter: $ => token(
      choice(
        /-+[a-zA-Z_?][^\{\}\(\);,\|\&\.\[:\s]*/,
        "--"
      )
    ),

    _verbatim_command_argument_chars: $ => repeat1(
      choice(
        /"[^"]*"/,
        /&[^&]*/,
        /[^\|\n]+/
      )
    ),

    // Grammar

    // Statements

    script_block: $ => choice(
      $.script_block_body,
      seq(seq($.param_block, $._statement_terminator, repeat(";")), optional($.script_block_body))
    ),

    param_block: $ => seq(
      optional($.attribute_list), "param", "(", optional($.parameter_list), ")"
    ),

    parameter_list: $ => seq(
      $.script_parameter,
      repeat(seq(",", $.script_parameter))
    ),

    script_parameter: $ => seq(
      optional($.attribute_list), $.variable, optional($.script_parameter_default)
    ),

    script_parameter_default: $ => seq(
      "=", $._expression
    ),

    script_block_body: $ => choice(
      $.named_block_list,
      $._statement_list
    ),
    
    named_block_list: $ => repeat1(
      $.named_block
    ),

    named_block: $ => seq(
      $.block_name, $.statement_block
    ),

    block_name: $ => choice(
      "dynamicparam",
      "begin",
      "process",
      "end"
    ),

    statement_block: $ => seq(
      "{", optional($._statement_list), "}"
    ),

    _statement_list: $ => repeat1($._statement),

    _statement: $ => prec.right(choice(
      $.if_statement,
      seq(optional($.label), $._labeled_statement),
      $.function_statement,
      $.class_statement,
      $.enum_statement,
      seq($.flow_control_statement, $._statement_terminator),
      $.trap_statement,
      $.try_statement,
      $.data_statement,
      $.inlinescript_statement,
      $.parallel_statement,
      $.sequence_statement,
      seq($.pipeline, $._statement_terminator),
      $.empty_statement
    )),

    empty_statement: $ => prec(PREC.EMPTY, ";"),

    if_statement: $ => prec.left(seq(
      "if", "(", $.pipeline, ")", $.statement_block, optional($.elseif_clauses), optional($.else_clause)
    )),

    elseif_clauses: $ => prec.left(repeat1($.elseif_clause)),

    elseif_clause: $ => seq(
      "elseif", "(", $.pipeline, ")", $.statement_block
    ),

    else_clause: $ => seq("else", $.statement_block),

    _labeled_statement: $ => choice(
      $.switch_statement,
      $.foreach_statement,
      $.for_statement,
      $.while_statement,
      $.do_statement
    ),

    switch_statement: $ => seq(
      "switch", optional($.switch_parameters), $.switch_condition, $.switch_body
    ),

    switch_parameters: $ => repeat1($.switch_parameter),

    switch_parameter: $ => choice(
      "-regex",
      "-wildcard",
      "-exact",
      "-casesensitive",
      "-parallel"
    ),

    switch_condition: $ => choice(
      seq("(", $.pipeline, ")"),
      seq("-file", $.switch_filename)
    ),

    switch_filename: $ => choice(
      $._command_argument,
      $._primary_expression
    ),

    switch_body: $ => seq("{", optional($.switch_clauses), "}"),

    switch_clauses: $ => repeat1($.switch_clause),

    switch_clause: $ => seq($.switch_clause_condition, $.statement_block, $._statement_terminator),

    switch_clause_condition: $ => choice(
      $._command_argument,
      $._primary_expression
    ),

    foreach_statement: $ => seq(
      "foreach", optional($.foreach_parameter), "(", $.variable, "in", $.pipeline, ")", $.statement_block
    ),

    foreach_parameter: $ => choice(
      "-parallel"
    ),

    for_statement: $ => seq(
      "for", "(",
        optional(
          seq(optional(seq($.for_initializer, $._statement_terminator)), 
            optional(
              seq(choice(";", "\n"), optional(seq($.for_condition, $._statement_terminator)),
                optional(
                  seq(choice(";", "\n"), optional(seq($.for_iterator, $._statement_terminator)))
                )
              )
            )
          ),
        ),
        ")", $.statement_block
    ),

    for_initializer: $ => $.pipeline,

    for_condition: $ => $.pipeline,

    for_iterator: $ => $.pipeline,

    while_statement: $ => seq(
      "while", "(", $.while_condition, ")", $.statement_block
    ),

    while_condition: $=> $.pipeline,

    do_statement: $ => seq(
      "do", $.statement_block, choice("while", "until"), "(", $.while_condition, ")"
    ),

    function_statement: $ => seq(
      choice(
        "function",
        "filter",
        "workflow"
      ),
      $.function_name,
      optional($.function_parameter_declaration),
      "{", optional($.script_block), "}"
    ),

    function_name: $ => $._command_argument,

    function_parameter_declaration: $ => seq(
      "(", $.parameter_list, ")"
    ),

    flow_control_statement: $ => choice(
      seq("break", optional($.label_expression)),
      seq("continue", optional($.label_expression)),
      seq("throw", optional($.pipeline)),
      seq("return", optional($.pipeline)),
      seq("exit", optional($.pipeline))
    ),

    label: $ => token(seq(":", /[a-zA-Z_][a-zA-Z0-9_]*/)),

    label_expression: $ => choice(
      $.label,
      $.unary_expression
    ),

    trap_statement: $ => seq(
      "trap", optional($.type_literal), $.statement_block
    ),

    try_statement: $ => seq(
      "try",
      $.statement_block,
      choice(
        seq($.catch_clauses, optional($.finally_clause)),
        optional($.finally_clause)
      )
    ),

    catch_clauses: $ => repeat1($.catch_clause),

    catch_clause: $ => seq(
      "catch", optional($.catch_type_list), $.statement_block
    ),

    catch_type_list: $ => seq(
      $.type_literal,
      repeat(
        seq(",", $.type_literal)
      )
    ),

    finally_clause: $ => seq(
      "finally", $.statement_block
    ),

    data_statement: $ => seq(
      "data", $.data_name, optional($.data_commands_allowed), $.statement_block
    ),

    data_name: $ =>$.simple_name,

    data_commands_allowed: $ => seq(
      "-supportedcommand", $.data_commands_list
    ),

    data_commands_list: $ => seq(
      $.data_command,
      repeat(seq(",", $.data_command))
    ),

    data_command: $ => $.command_name_expr,

    inlinescript_statement: $ => seq(
      "inlinescript", $.statement_block
    ),

    parallel_statement: $ => seq(
      "parallel", $.statement_block
    ),

    sequence_statement: $ => seq(
      "sequence", $.statement_block
    ),

    pipeline: $ => choice(
      $.assignment_expression,
      seq($._expression, optional($.redirections), optional($._pipeline_tail)),
      seq($.command, optional($.verbatim_command_argument), optional($._pipeline_tail))
    ),

    assignment_expression: $ => seq(
      $._expression, $.assignement_operator, $._statement
    ),

    _pipeline_tail: $ => repeat1(
      seq('|', $.command)
    ),

    command: $ => prec.left(choice(
      seq($.command_name, optional($._command_elements)),
      seq($.command_invokation_operator, /*optional($.command_module),*/ $.command_name_expr, optional($._command_elements))
    )),

    command_invokation_operator: $ => choice(
      ".",
      "&"
    ),

    // This rule is ignored as it does not appear as a rule
    //command_module: $ => $.primary_expression,
    _expandable_string_literal_immediate: $ => seq(
      repeat(
        choice(
          /[^\$"`]+/,
          $.variable,
          /\$`(.{1}|`\n)/,
          /`.{1}|`\n/,
          "\"\"",
          $.sub_expression
        )
      ),
      repeat("$"),
      "\""
    ),

    command_name: $ => prec.right(seq(
      /[^\{\}\(\);,\|\&`"'\s\n\[\]\+\-\$@<]+/,
      repeat(
        choice(
          token.immediate(/[^\{\}\(\);,\|\&`"'\s\n]+/),
          seq(token.immediate("\""), $._expandable_string_literal_immediate),
          token.immediate("\"\""),
          token.immediate("''")
        )
      )
    )),

    command_name_expr: $ => choice(
      $.command_name,
      $._primary_expression
    ),

    _command_elements: $ => repeat1($._command_element),

    _command_element: $ => choice(
      $.command_parameter,
      $._command_argument,
      $.redirection
    ),

    // Adapt the grammar to have same behavior
    _command_argument: $ => choice(
      $.generic_token,
      $._primary_expression
    ),

    verbatim_command_argument: $ => seq(
      "--%", $._verbatim_command_argument_chars
    ),

    redirections: $ => repeat1($.redirection),

    redirection: $ => choice(
      $.merging_redirection_operator,
      seq($.file_redirection_operator, $.redirected_file_name)
    ),

    redirected_file_name: $ => choice(
      $._command_argument,
      $._primary_expression
    ),

    // Class
    class_attribute : $ => choice("hidden", "static"),

    class_property_definition: $ => seq(
      optional($.attribute),
      repeat($.class_attribute),
      optional($.type_literal),
      $.variable,
      optional(
        seq(
          "=",
          $._expression
        )
      )
    ),

    class_method_parameter: $ => seq(
      optional($.type_literal),
      $.variable
    ),

    class_method_parameter_list: $ => seq(
      $.class_method_parameter,
      repeat(seq(",", $.class_method_parameter))
    ),

    class_method_definition: $ => seq(
      optional($.attribute),
      repeat($.class_attribute),
      optional($.type_literal),
      $.simple_name,
      "(", optional($.class_method_parameter_list), ")",
      "{", optional($.script_block), "}"
    ),

    class_statement: $ => seq(
      "class", $.simple_name, optional(seq(":", $.simple_name, repeat(seq(",", $.simple_name)))), 
      "{",
      repeat(
        choice(
          seq($.class_property_definition, $._statement_terminator),
          $.class_method_definition
        )
      ),
      "}"
    ),

    enum_statement: $ => seq(
      "enum", $.simple_name, "{",
      repeat(
        seq($.simple_name, optional(seq("=", $.integer_literal)))
      ),
      "}"
    ),

    // Expressions
    
    _expression: $ => $.logical_expression,

    logical_expression: $ => seq(
      $.bitwise_expression,
      repeat(
        seq(choice("-and", "-or", "-xor"), $.bitwise_expression)
      )
    ),

    bitwise_expression: $ => seq(
      $.comparison_expression,
      repeat(
        seq(choice("-band", "-bor", "-bxor"), $.comparison_expression)
      )
    ),

    comparison_expression: $ => prec.left(seq(
      $.additive_expression,
      repeat(
        seq($.comparison_operator, $.additive_expression)
      )
    )),

    additive_expression: $ => prec.left(seq(
      $.multiplicative_expression,
      repeat(
        seq(choice("+", "-"), $.multiplicative_expression)
      )
    )),

    multiplicative_expression: $ => prec.left(seq(
      $.format_expression,
      repeat(
        seq(choice("/", "\\", "%", "*"), $.format_expression)
      )
    )),

    format_expression: $ => prec.left(seq(
      $.range_expression,
      repeat(
        seq($.format_operator, $.range_expression)
      )
    )),

    range_expression: $ => seq(
      $.array_literal_expression,
      repeat(
        seq("..", $.array_literal_expression)
      )
    ),

    array_literal_expression: $ => prec.left(seq(
      $.unary_expression,
      repeat(
        seq(",", $.unary_expression)
      )
    )),

    unary_expression: $ => prec.right(choice(
      $._primary_expression,
      $.expression_with_unary_operator
    )),

    expression_with_unary_operator: $ => choice(
      seq(",", $.unary_expression),
      seq("-not", $.unary_expression),
      seq("!", $.unary_expression),
      seq("-bnot", $.unary_expression),
      seq("+", $.unary_expression),
      seq("-", $.unary_expression),
      $.pre_increment_expression,
      $.pre_decrement_expression,
      $.cast_expression,
      seq("-split", $.unary_expression),
      seq("-join", $.unary_expression)
    ),

    pre_increment_expression: $ => seq("++", $.unary_expression),
    pre_decrement_expression: $ => seq("--", $.unary_expression),


    cast_expression: $ => prec(PREC.CAST, seq($.type_literal, $.unary_expression)),

    attributed_variable: $ => seq($.type_literal, $.variable),

    _primary_expression: $ => choice(
      $._value,
      $.member_access,
      $.element_access,
      $.invokation_expression,
      $.post_increment_expression,
      $.post_decrement_expression
    ),

    _value: $ => choice(
      $.parenthesized_expression,
      $.sub_expression,
      $.array_expression,
      $.script_block_expression,
      $.hash_literal_expression,
      $._literal,
      $.type_literal,
      $.variable
    ),

    parenthesized_expression: $ => seq("(", $.pipeline, ")"),

    sub_expression: $ => seq("$(", optional($._statement_list), ")"),

    array_expression: $ => seq("@(", optional($._statement_list), ")"),

    script_block_expression: $ => seq("{", $.script_block, "}"),

    hash_literal_expression: $ => seq("@{", optional($.hash_literal_body), "}"),

    hash_literal_body: $ => repeat1($.hash_entry),

    hash_entry: $ => seq(
      $.key_expression, 
      "=", 
      $._statement, $._statement_terminator, repeat(";")
    ),

    key_expression: $ => choice(
      $.simple_name,
      $.unary_expression
    ),

    post_increment_expression: $ => prec(PREC.UNARY, seq($._primary_expression, "++")),

    post_decrement_expression: $ => prec(PREC.UNARY, seq($._primary_expression, "--")),

    member_access: $ => prec.left(choice(
      seq($._primary_expression, token.immediate("."), $.member_name),
      seq($._primary_expression, "::", $.member_name),
    )),

    member_name: $ => choice(
      $.simple_name,
      $.string_literal,
      $.expression_with_unary_operator,
      $._value
    ),

    element_access: $ => prec(PREC.ELEMENT_ACCESS, seq($._primary_expression, "[", $._expression, "]")),

    invokation_expression: $ => choice(
      seq($._primary_expression, token.immediate("."), $.member_name, $.argument_list),
      seq($._primary_expression, "::", $.member_name, $.argument_list),
      $.invokation_foreach_expression
    ),

    // adding this rule to handle .foreach synthax
    invokation_foreach_expression: $ => seq($._primary_expression, token.immediate(".foreach"), $.script_block_expression),

    argument_list: $ => seq("(", optional($.argument_expression_list), ")"),

    argument_expression_list: $ => prec.left(seq(
      $.argument_expression,
      repeat(
        seq(",", $.argument_expression)
      )
    )),

    argument_expression: $ => $.logical_argument_expression,

    logical_argument_expression: $ => seq(
      $.bitwise_argument_expression,
      repeat(
        seq(choice("-and", "-or", "-xor"), $.bitwise_argument_expression)
      )
    ),

    bitwise_argument_expression: $ => seq(
      $.comparison_argument_expression,
      repeat(
        seq(choice("-band", "-bor", "-bxor"), $.comparison_argument_expression)
      )
    ),

    comparison_argument_expression: $ => prec.left(seq(
      $.additive_argument_expression,
      repeat(
        seq($.comparison_operator, $.additive_argument_expression)
      )
    )),

    additive_argument_expression: $ => prec.left(seq(
      $.multiplicative_argument_expression,
      repeat(
        seq(choice("+", "-"), $.multiplicative_argument_expression)
      )
    )),

    multiplicative_argument_expression: $ => prec.left(seq(
      $.format_argument_expression,
      repeat(
        seq(choice("/", "\\", "%", "*"), $.format_argument_expression)
      )
    )),

    format_argument_expression: $ => seq(
      $.range_argument_expression,
      repeat(
        seq($.format_operator, $.range_argument_expression)
      )
    ),

    range_argument_expression: $ => seq(
      $.unary_expression,
      repeat(
        seq("..", $.unary_expression)
      )
    ),

    type_literal: $ => seq("[", $.type_spec, "]"),

    type_spec: $ => choice(
      seq($.array_type_name, optional($.dimension), "]"),
      seq($.generic_type_name, $.generic_type_arguments, "]"),
      $.type_name
    ),

    dimension: $ => repeat1(","),

    generic_type_arguments: $ => seq(
      $.type_spec,
      repeat(seq(",", $.type_spec))
    ),

    // Attributes
    attribute_list: $ => repeat1($.attribute),

    attribute: $ => choice(
      seq("[", $.attribute_name, "(", optional($.attribute_arguments), ")", "]"),
      $.type_literal
    ),

    attribute_name: $ => $.type_spec,

    attribute_arguments: $ => seq(
      $.attribute_argument,
      repeat(seq(",", $.attribute_argument))
    ),

    attribute_argument: $ => choice(
      $._expression,
      seq($.simple_name, optional(seq("=", $._expression)))
    )
  },
});