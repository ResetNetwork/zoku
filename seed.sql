-- Zoku Seed Data

-- Dimensions
INSERT INTO dimensions (id, name, label, description, allow_multiple) VALUES
  ('dim_status', 'status', 'Status', 'Current status of the entanglement', 0),
  ('dim_function', 'function', 'Function', 'Primary organizational function', 0),
  ('dim_pillar', 'pillar', 'Pillar', 'Innovation pillar (Technology Innovation only)', 0),
  ('dim_service', 'service_area', 'Service Area', 'IT service area (Information Technology only)', 0);

-- Status values
INSERT INTO dimension_values (id, dimension_id, value, label, sort_order) VALUES
  ('val_draft', 'dim_status', 'draft', 'Draft', 1),
  ('val_active', 'dim_status', 'active', 'Active', 2),
  ('val_paused', 'dim_status', 'paused', 'Paused', 3),
  ('val_complete', 'dim_status', 'complete', 'Complete', 4),
  ('val_archived', 'dim_status', 'archived', 'Archived', 5);

-- Function values
INSERT INTO dimension_values (id, dimension_id, value, label, sort_order) VALUES
  ('val_tech_innovation', 'dim_function', 'tech_innovation', 'Technology Innovation', 1),
  ('val_info_tech', 'dim_function', 'info_tech', 'Information Technology', 2);

-- Pillar values (Technology Innovation)
INSERT INTO dimension_values (id, dimension_id, value, label, depends_on_value_id, sort_order) VALUES
  ('val_operational', 'dim_pillar', 'operational', 'Operational', 'val_tech_innovation', 1),
  ('val_programmatic', 'dim_pillar', 'programmatic', 'Programmatic', 'val_tech_innovation', 2),
  ('val_r_and_d', 'dim_pillar', 'r_and_d', 'R&D', 'val_tech_innovation', 3);

-- Service Area values (Information Technology)
INSERT INTO dimension_values (id, dimension_id, value, label, depends_on_value_id, sort_order) VALUES
  ('val_helpdesk', 'dim_service', 'helpdesk', 'Helpdesk', 'val_info_tech', 1),
  ('val_tools_services', 'dim_service', 'tools_services', 'Tools & Services', 'val_info_tech', 2),
  ('val_cyber_security', 'dim_service', 'cyber_security', 'Cyber Security', 'val_info_tech', 3),
  ('val_identity_access', 'dim_service', 'identity_access', 'Identity & Access', 'val_info_tech', 4);
