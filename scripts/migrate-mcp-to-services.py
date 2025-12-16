#!/usr/bin/env python3
"""
Script to help migrate MCP tools to use services.
Generates the service-based implementations for all 29 tools.
"""

# Tool name -> service mapping
TOOL_MAPPINGS = {
    # Entanglement tools
    'list_entanglements': ('entanglements', 'list', ['args']),
    'get_entanglement': ('entanglements', 'get', ['args.id', 'args.include_children_qupts', 'args.detailed ? 50 : 20']),
    'get_child_entanglements': ('entanglements', 'getChildren', ['args.parent_id', 'args.recursive']),
    'create_entanglement': ('entanglements', 'create', ['args']),
    'update_entanglement': ('entanglements', 'update', ['args.id', 'args']),
    'move_entanglement': ('entanglements', 'move', ['args.id', 'args.new_parent_id']),
    'delete_entanglement': ('entanglements', 'delete', ['args.id', 'args.confirm']),
    'get_matrix': ('entanglements', 'getMatrix', ['args.entanglement_id']),
    'entangle': ('entanglements', 'assignToMatrix', ['args.entanglement_id', 'args']),
    'disentangle': ('entanglements', 'removeFromMatrix', ['args.entanglement_id', 'args.zoku_id', 'args.role']),
    'get_attributes': ('entanglements', 'getAttributes', ['args.entanglement_id']),
    'list_sources': ('entanglements', 'listSources', ['args.entanglement_id']),
    
    # Zoku tools
    'list_zoku': ('zoku', 'list', ['args']),
    'create_zoku': ('zoku', 'create', ['args']),
    'get_entangled': ('zoku', 'get', ['args.id']),
    
    # Qupt tools
    'list_qupts': ('qupts', 'list', ['args']),
    'create_qupt': ('qupts', 'create', ['args']),
    
    # Jewel tools
    'add_jewel': ('jewels', 'create', ['args']),
    'list_jewels': ('jewels', 'list', ['args']),
    'get_jewel': ('jewels', 'get', ['args.id']),
    'update_jewel': ('jewels', 'update', ['args.id', 'args']),
    'delete_jewel': ('jewels', 'delete', ['args.id']),
    'get_jewel_usage': ('jewels', 'getUsage', ['args.id']),
    
    # Source tools
    'add_source': ('sources', 'create', ['args.entanglement_id', 'args']),
    'sync_source': ('sources', 'sync', ['args.source_id']),
    'remove_source': ('sources', 'delete', ['args.source_id']),
    'toggle_source': ('sources', 'update', ['args.source_id', '{ enabled: args.enabled }']),
}

def generate_tool_impl(tool_name, service_name, method_name, method_args):
    """Generate TypeScript code for a single tool using services"""
    args_str = ', '.join(method_args)
    
    return f"""  server.registerTool(
    '{tool_name}',
    {{
      description: schemas.{tool_name}.description,
      inputSchema: schemas.{tool_name}
    }},
    async (args, extra) => {{
      return mcpToolWrapper('{tool_name}', logger, extra.sessionId, async () => {{
        const result = await services.{service_name}.{method_name}({args_str});
        return result;
      }});
    }}
  );
"""

def main():
    print("// Generated MCP tool registrations using services\n")
    
    for tool_name, (service, method, args) in sorted(TOOL_MAPPINGS.items()):
        code = generate_tool_impl(tool_name, service, method, args)
        print(code)
    
    print(f"\n// Total tools migrated: {len(TOOL_MAPPINGS)}")

if __name__ == '__main__':
    main()
