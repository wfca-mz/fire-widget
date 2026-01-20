-- ============================================================================
-- WFCA Active Fires Widget - Database Layer
-- ============================================================================
-- This view JOINs perimeter data (for bbox/geometry) with incident data 
-- (for acreage, state, county) to provide complete fire information.
--
-- Data Sources:
--   - vw_wfigs_interagency_perimeters_current_bbox: bbox, active filter, recency
--   - mvw_wfigs_incident_locations_current_history: acreage, state, county
--
-- JOIN Strategy:
--   - Match on irwinid
--   - Get latest incident record per irwinid (most recent modifiedondatetime_dt)
-- ============================================================================

CREATE OR REPLACE VIEW data.vw_active_fires_widget AS
WITH 
-- Get latest incident record per irwinid for acreage/location data
latest_incidents AS (
    SELECT DISTINCT ON (irwinid)
        irwinid,
        wfca_reportedacres,
        poostate,
        poocounty,
        percentcontained,
        incidentname
    FROM data.mvw_wfigs_incident_locations_current_history
    ORDER BY irwinid, modifiedondatetime_dt DESC NULLS LAST
),
-- Parse bbox coordinates from perimeter view
bbox_parsed AS (
    SELECT 
        p.gid,
        p.poly_incidentname,
        p.poly_datecurrent,
        p.attr_irwinid,
        p.attr_modifiedondatetime_dt,
        p.globalid,
        p.wfca_timestamp,
        p.bbox,
        -- Extract coordinates from bbox GeoJSON to calculate center
        (p.bbox::jsonb -> 'coordinates' -> 0 -> 0 -> 0)::float AS min_lng,
        (p.bbox::jsonb -> 'coordinates' -> 0 -> 0 -> 1)::float AS min_lat,
        (p.bbox::jsonb -> 'coordinates' -> 0 -> 2 -> 0)::float AS max_lng,
        (p.bbox::jsonb -> 'coordinates' -> 0 -> 2 -> 1)::float AS max_lat
    FROM data.vw_wfigs_interagency_perimeters_current_bbox p
)
SELECT 
    bp.gid,
    -- Prefer incident name from locations (often cleaner), fallback to perimeter name
    COALESCE(li.incidentname, bp.poly_incidentname) AS fire_name,
    bp.poly_datecurrent AS date_current,
    bp.attr_irwinid AS irwin_id,
    bp.attr_modifiedondatetime_dt AS modified_at,
    bp.globalid,
    bp.wfca_timestamp,
    
    -- Acreage and location from incident data
    li.wfca_reportedacres AS acres,
    li.poostate AS state,
    li.poocounty AS county,
    li.percentcontained AS percent_contained,
    
    -- Calculate center point for map URL
    ROUND(((bp.min_lng + bp.max_lng) / 2)::numeric, 6) AS center_lng,
    ROUND(((bp.min_lat + bp.max_lat) / 2)::numeric, 6) AS center_lat,
    
    -- Calculate appropriate zoom based on bbox size (larger bbox = lower zoom)
    CASE 
        WHEN GREATEST(bp.max_lng - bp.min_lng, bp.max_lat - bp.min_lat) > 0.5 THEN 9
        WHEN GREATEST(bp.max_lng - bp.min_lng, bp.max_lat - bp.min_lat) > 0.1 THEN 11
        WHEN GREATEST(bp.max_lng - bp.min_lng, bp.max_lat - bp.min_lat) > 0.01 THEN 13
        ELSE 15
    END AS suggested_zoom,
    
    bp.bbox AS bbox_geojson
    
FROM bbox_parsed bp
-- LEFT JOIN so we still show fires even if incident data is missing
LEFT JOIN latest_incidents li ON bp.attr_irwinid = li.irwinid
-- Order by acreage DESC (largest fires first), then by modified date
ORDER BY li.wfca_reportedacres DESC NULLS LAST, bp.attr_modifiedondatetime_dt DESC NULLS LAST;

-- Grant access to your read-only role
GRANT SELECT ON data.vw_active_fires_widget TO readaccess;

COMMENT ON VIEW data.vw_active_fires_widget IS 
'Widget view joining perimeter bbox with incident acreage/location data. Sorted by largest fires first.';
