import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

import { buildDataset, castTranslations, formatSlug } from '@/utils/taxonomy'

function getVisitPath(path: string[]): string {
  return path.join('.')
}

function readSourceYaml<T = unknown>(relativePath: string): T {
  return YAML.parse(readFileSync(resolve(process.cwd(), relativePath), 'utf8')) as T
}

function collectMatchingTagPaths(parsed: unknown, expectedPaths: Map<string, string>): Array<{ tag: string, path: string }> {
  const rows: Array<{ tag: string, path: string }> = []

  function visit(value: unknown, path: string[]): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && expectedPaths.has(item)) {
          rows.push({ tag: item, path: getVisitPath(path) })
        }
      }

      return
    }

    if (typeof value !== 'object' || value === null) {
      return
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      visit(nestedValue, [...path, key])
    }
  }

  visit(parsed, [])

  return rows
}

describe('taxonomy helpers', () => {
  it('builds nested nodes and aggregates tag counts', () => {
    const dataset = buildDataset(
      {
        _meta: { version: 'test' },
        root_a: {
          branch_b: ['alpha_tag', 'beta_tag'],
          branch_c: {
            leaf_d: ['gamma_tag'],
          },
        },
      },
      'default',
    )

    const rootA = dataset.nodes.root_a
    const branchB = dataset.nodes['root_a.branch_b']
    const branchC = dataset.nodes['root_a.branch_c']

    expect(rootA).toBeDefined()
    expect(branchB).toBeDefined()
    expect(branchC).toBeDefined()

    if (!rootA || !branchB || !branchC) {
      throw new Error('Expected taxonomy nodes to exist')
    }

    expect(dataset.totalNodeCount).toBe(4)
    expect(dataset.totalTagCount).toBe(3)
    expect(rootA.totalTagCount).toBe(3)
    expect(branchB.directTagCount).toBe(2)
    expect(branchC.descendantCount).toBe(1)
  })

  it('casts translation entries and falls back to slug formatting', () => {
    const translations = castTranslations({
      'category.subject': {
        en: 'subject',
        'zh-CN': '主体',
      },
    })

    expect(translations['category.subject']?.['zh-CN']).toBe('主体')
    expect(formatSlug('black_hair')).toBe('black hair')
  })

  it('keeps source taxonomy free of non-leaf _tags buckets', () => {
    const source = readFileSync(resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml'), 'utf8')

    expect(source).not.toContain('\n_tags:')
  })

  it('keeps camera-angle tags separated by viewpoint semantics', () => {
    const parsed = readSourceYaml<{
      composition: {
        camera_angle: Record<string, unknown>
        framing: {
          arrangement: string[]
        }
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['from_behind', 'composition.camera_angle.orientation'],
      ['from_side', 'composition.camera_angle.orientation'],
      ['profile', 'composition.camera_angle.orientation'],
      ['from_above', 'composition.camera_angle.orientation'],
      ['from_below', 'composition.camera_angle.orientation'],
      ['facing_viewer', 'composition.camera_angle.orientation'],
      ['straight-on', 'composition.camera_angle.orientation'],
      ['three_quarter_view', 'composition.camera_angle.orientation'],
      ['sideways', 'composition.camera_angle.orientation'],
      ['three_quarter_profile', 'composition.camera_angle.orientation'],
      ['looking_past_viewer', 'composition.camera_angle.orientation'],
      ['high_up', 'composition.camera_angle.orientation'],
      ['under_shot', 'composition.camera_angle.orientation'],
      ['chest_height', 'composition.camera_angle.orientation'],
      ['worm\'s_eye_view', 'composition.camera_angle.orientation'],
      ['dutch_angle', 'composition.camera_angle.perspective'],
      ['foreshortening', 'composition.camera_angle.perspective'],
      ['perspective', 'composition.camera_angle.perspective'],
      ['fisheye', 'composition.camera_angle.perspective'],
      ['vanishing_point', 'composition.camera_angle.perspective'],
      ['isometric', 'composition.camera_angle.perspective'],
      ['forced_perspective', 'composition.camera_angle.perspective'],
      ['dollhouse_view', 'composition.camera_angle.perspective'],
      ['pov', 'composition.camera_angle.subjective_view'],
      ['pov_hands', 'composition.camera_angle.subjective_view'],
      ['pov_crotch', 'composition.camera_angle.subjective_view'],
      ['female_pov', 'composition.camera_angle.subjective_view'],
      ['pov_doorway', 'composition.camera_angle.subjective_view'],
      ['pov_across_table', 'composition.camera_angle.subjective_view'],
      ['against_fourth_wall', 'composition.camera_angle.subjective_view'],
      ['pov_peephole', 'composition.camera_angle.subjective_view'],
      ['pov_across_bed', 'composition.camera_angle.subjective_view'],
      ['taker_pov', 'composition.camera_angle.subjective_view'],
      ['pov_breasts', 'composition.camera_angle.subjective_view'],
      ['pov_legs', 'composition.camera_angle.subjective_view'],
      ['pov_dating', 'composition.camera_angle.subjective_view'],
      ['pov_shadow', 'composition.camera_angle.subjective_view'],
      ['lap_pov', 'composition.camera_angle.subjective_view'],
      ['pov_adoring', 'composition.camera_angle.subjective_view'],
      ['multiple_pov', 'composition.camera_angle.subjective_view'],
      ['pov_stomped', 'composition.camera_angle.subjective_view'],
      ['under_table', 'composition.camera_angle.situated_view'],
      ['partially_underwater_shot', 'composition.camera_angle.situated_view'],
      ['view_between_legs', 'composition.camera_angle.situated_view'],
      ['extended_downblouse', 'composition.camera_angle.situated_view'],
      ['through_window', 'composition.camera_angle.situated_view'],
      ['under_skirt', 'composition.camera_angle.situated_view'],
      ['from_inside', 'composition.camera_angle.situated_view'],
      ['around_corner', 'composition.camera_angle.situated_view'],
      ['refrigerator_interior', 'composition.camera_angle.situated_view'],
      ['through_ground', 'composition.camera_angle.situated_view'],
      ['behind_tree', 'composition.camera_angle.situated_view'],
      ['behind_curtains', 'composition.camera_angle.situated_view'],
      ['through_portal', 'composition.camera_angle.situated_view'],
      ['from_hat_trick', 'composition.camera_angle.situated_view'],
      ['in_trunk', 'composition.camera_angle.situated_view'],
      ['in_refrigerator', 'composition.camera_angle.situated_view'],
      ['from_outside', 'composition.camera_angle.situated_view'],
      ['mirror_selfie', 'composition.camera_angle.mediated_view'],
      ['viewer_holding_phone', 'composition.camera_angle.mediated_view'],
      ['against_mirror', 'composition.camera_angle.mediated_view'],
      ['eyewear_view', 'composition.camera_angle.mediated_view'],
      ['fixed-point_camera', 'composition.camera_angle.mediated_view'],
      ['through_mirror', 'composition.camera_angle.mediated_view'],
      ['knolling', 'composition.framing.arrangement'],
    ])

    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.composition.camera_angle).toHaveProperty('orientation')
    expect(parsed.composition.camera_angle).toHaveProperty('perspective')
    expect(parsed.composition.camera_angle).toHaveProperty('subjective_view')
    expect(parsed.composition.camera_angle).toHaveProperty('situated_view')
    expect(parsed.composition.camera_angle).toHaveProperty('mediated_view')
    expect(parsed.composition.framing.arrangement).toContain('knolling')
    expect(parsed.composition.camera_angle).not.toBeInstanceOf(Array)
  })

  it('keeps selected head and shoulder anchor tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['animal_on_head', 'composition.framing.body_part_anchor.head'],
      ['book_on_head', 'composition.framing.body_part_anchor.head'],
      ['on_head', 'composition.framing.body_part_anchor.head'],
      ['animal_on_shoulder', 'composition.framing.body_part_anchor.shoulder.on_shoulder'],
      ['on_shoulder', 'composition.framing.body_part_anchor.shoulder.on_shoulder'],
      ['hands_on_shoulders', 'composition.framing.body_part_anchor.shoulder.general'],
      ['arm_over_shoulder', 'composition.framing.body_part_anchor.shoulder.over_shoulder'],
      ['holding_over_opposite_shoulder', 'composition.framing.body_part_anchor.shoulder.over_shoulder'],
      ['arm_around_shoulder', 'composition.framing.body_part_anchor.shoulder.general'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed).not.toHaveProperty('composition.framing.body_part_anchor.shoulder.on_shoulders')
    expect(parsed).not.toHaveProperty('composition.framing.body_part_anchor.shoulder.around_shoulder')
  })

  it('keeps lap placement tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedTags = new Set([
      'animal_on_lap',
      'bag_on_lap',
      'book_on_lap',
      'cat_on_lap',
      'creature_on_lap',
      'hand_on_lap',
      'hands_on_lap',
      'lap',
      'lying_on_lap',
      'on_lap',
      'pokemon_on_lap',
      'sitting_on_lap',
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedTags.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedTags.size)
    expect(rows.every((row) => row.path === 'composition.framing.body_part_anchor.lap')).toBe(true)
  })

  it('keeps selected face anchor tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['animal_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['butterfly_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['chocolate_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['cream_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['fan_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['food_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['hair_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['hand_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['ice_cream_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['paint_splatter_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['phone_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['pie_in_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['rice_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['tail_on_face', 'composition.framing.body_part_anchor.face.on_face'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
    expect(parsed).not.toHaveProperty('apparel.body_part_placement.neck.behind_neck')
  })

  it('keeps selected headwear relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['adjusting_headwear', 'apparel.headwear.interaction'],
      ['cum_on_headwear', 'apparel.headwear.on_headwear'],
      ['eyewear_on_headwear', 'apparel.headwear.on_headwear'],
      ['goggles_on_headwear', 'apparel.headwear.on_headwear'],
      ['hand_on_headwear', 'apparel.headwear.interaction'],
      ['hands_on_headwear', 'apparel.headwear.interaction'],
      ['headphones_over_headwear', 'apparel.headwear.on_headwear'],
      ['headwear_switch', 'apparel.headwear.interaction'],
      ['putting_on_headwear', 'apparel.headwear.interaction'],
      ['snow_on_headwear', 'apparel.headwear.on_headwear'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
    expect(parsed).not.toHaveProperty('apparel.headwear.state')
    expect(parsed).not.toHaveProperty('apparel.headwear.over_headwear')
  })

  it('flattens redundant single-child wrappers in selected branches', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      apparel: {
        headwear: Record<string, unknown>
      }
      character: {
        archetype: {
          form: Record<string, unknown>
        }
      }
      dynamics: {
        action: {
          combat: Record<string, unknown>
          gesture: Record<string, unknown>
          object_manipulation: {
            holding: Record<string, unknown>
          }
        }
        interaction: {
          contact: Record<string, unknown>
        }
        pose: {
          arm_hand: Record<string, unknown>
        }
      }
    }
    const expectedPaths = new Map([
      ['inkling', 'character.archetype.form.general'],
      ['monster_girl', 'character.archetype.form.female'],
      ['elbow_rest', 'dynamics.pose.arm_hand.elbow_wrist'],
      ['head_rest', 'dynamics.pose.arm_hand.general'],
      ['asymmetrical_dual_wielding', 'dynamics.action.combat.general'],
      ['fighting_stance', 'dynamics.action.combat.stance'],
      ['attack', 'dynamics.action.combat.impact'],
      ['blowing_kiss', 'dynamics.action.gesture.greeting'],
      ['v', 'dynamics.action.gesture.general'],
      ['carrying_under_arm', 'dynamics.action.object_manipulation.holding.general'],
      ['mouth_hold', 'dynamics.action.object_manipulation.holding.grip_style'],
      ['holding', 'dynamics.action.object_manipulation.holding.general'],
      ['foot_on_another\'s_face', 'dynamics.interaction.contact.general'],
      ['hand_on_another\'s_head', 'dynamics.interaction.contact.hand_on'],
      ['glomp', 'dynamics.interaction.contact.general'],
      ['headphones_over_headwear', 'apparel.headwear.on_headwear'],
      ['cum_on_headwear', 'apparel.headwear.on_headwear'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.archetype.form).not.toHaveProperty('kemono_type')
    expect(parsed.character.archetype.form).not.toHaveProperty('neutral')
    expect(parsed.dynamics.action.combat).not.toHaveProperty('weapon_use')
    expect(parsed.dynamics.action.gesture).not.toHaveProperty('face_gesture')
    expect(parsed.dynamics.action.object_manipulation.holding).not.toHaveProperty(
      'general_object_hold',
    )
    expect(parsed.dynamics.action.object_manipulation.holding).not.toHaveProperty('carry_object')
    expect(parsed.dynamics.interaction.contact).not.toHaveProperty('touch')
    expect(parsed.dynamics.interaction.contact).not.toHaveProperty('leg_contact')
    expect(parsed.apparel.headwear).not.toHaveProperty('state')
    expect(parsed.apparel.headwear).not.toHaveProperty('over_headwear')
  })

  it('keeps selected neck apparel relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['bandaid_on_neck', 'apparel.body_part_placement.neck.on_neck'],
      ['bandage_on_neck', 'apparel.body_part_placement.neck.on_neck'],
      ['bandana_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['camera_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['chain_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['earmuffs_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['eyewear_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['furoshiki_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['gag_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['goggles_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['headband_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['headphones_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['jacket_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['mask_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['rope_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['shirt_behind_neck', 'apparel.body_part_placement.neck.general'],
      ['sign_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['stethoscope_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['stopwatch_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['string_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['sweater_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['towel_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['whistle_around_neck', 'apparel.body_part_placement.neck.around_neck'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
  })

  it('keeps selected back anchor tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['animal_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['arms_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['arm_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['gun_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['hat_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['holding_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['holding_polearm_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['holding_sword_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['holding_weapon_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['instrument_case_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['instrument_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['pokemon_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['polearm_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['shield_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['sword_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['sword_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['weapon_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['weapon_on_back', 'composition.framing.body_part_anchor.back.on_back'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
  })

  it('keeps selected waist apparel relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['belt_around_waist', 'apparel.body_part_placement.waist'],
      ['cardigan_around_waist', 'apparel.body_part_placement.waist'],
      ['clothes_around_waist', 'apparel.body_part_placement.waist'],
      ['jacket_around_waist', 'apparel.body_part_placement.waist'],
      ['jumpsuit_around_waist', 'apparel.body_part_placement.waist'],
      ['rope_around_waist', 'apparel.body_part_placement.waist'],
      ['shirt_around_waist', 'apparel.body_part_placement.waist'],
      ['sweater_around_waist', 'apparel.body_part_placement.waist'],
      ['towel_around_waist', 'apparel.body_part_placement.waist'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
  })

  it('keeps selected wearable body relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      apparel: {
        body_part_placement: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['bandaid_on_head', 'apparel.body_part_placement.head'],
      ['bra_on_head', 'apparel.body_part_placement.head'],
      ['diving_mask_on_head', 'apparel.body_part_placement.head'],
      ['eyewear_on_head', 'apparel.body_part_placement.head'],
      ['goggles_on_head', 'apparel.body_part_placement.head'],
      ['mask_on_head', 'apparel.body_part_placement.head'],
      ['necktie_on_head', 'apparel.body_part_placement.head'],
      ['ofuda_on_head', 'apparel.body_part_placement.head'],
      ['panties_on_head', 'apparel.body_part_placement.head'],
      ['scarf_on_head', 'apparel.body_part_placement.head'],
      ['towel_on_head', 'apparel.body_part_placement.head'],
      ['bandage_on_face', 'apparel.body_part_placement.face'],
      ['bandaid_on_face', 'apparel.body_part_placement.face'],
      ['gauze_on_face', 'apparel.body_part_placement.face'],
      ['sticker_on_face', 'apparel.body_part_placement.face'],
      ['bandaid_on_shoulder', 'apparel.body_part_placement.shoulder.general'],
      ['cardigan_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['clothes_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['coat_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['haori_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['jacket_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['kimono_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['shirt_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['jacket_over_shoulder', 'apparel.body_part_placement.shoulder.general'],
      ['bandaid_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['gauze_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['sticker_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['towel_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['bandana_around_arm', 'apparel.body_part_placement.arm.around_arm'],
      ['chain_around_arm', 'apparel.body_part_placement.arm.around_arm'],
      ['bandaid_on_chest', 'apparel.body_part_placement.chest'],
      ['flower_on_chest', 'apparel.body_part_placement.chest'],
      ['bandaid_on_foot', 'apparel.body_part_placement.general'],
      ['bandaid_on_hand', 'apparel.body_part_placement.general'],
      ['bandaid_on_knee', 'apparel.body_part_placement.knee'],
      ['bandage_on_knee', 'apparel.body_part_placement.knee'],
      ['gauze_on_knee', 'apparel.body_part_placement.knee'],
      ['bandaid_on_leg', 'apparel.body_part_placement.leg'],
      ['bandage_on_leg', 'apparel.body_part_placement.leg'],
      ['gauze_on_leg', 'apparel.body_part_placement.leg'],
      ['ofuda_on_leg', 'apparel.body_part_placement.leg'],
      ['sticker_on_leg', 'apparel.body_part_placement.leg'],
      ['bandaid_on_stomach', 'apparel.body_part_placement.general'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
    expect(parsed.apparel.body_part_placement.head).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.face).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.shoulder).toHaveProperty('general')
    expect(parsed.apparel.body_part_placement.chest).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.knee).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.leg).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.waist).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement).toHaveProperty('general')
    expect(parsed.apparel.body_part_placement.shoulder).not.toHaveProperty('on_shoulder')
    expect(parsed.apparel.body_part_placement.shoulder).not.toHaveProperty('over_shoulder')
    expect(parsed.apparel.body_part_placement.neck).not.toHaveProperty('behind_neck')
    expect(parsed.apparel.body_part_placement).not.toHaveProperty('foot')
    expect(parsed.apparel.body_part_placement).not.toHaveProperty('hand')
    expect(parsed.apparel.body_part_placement).not.toHaveProperty('stomach')
  })

  it('keeps selected semantic body-part tags in non-anchor domains', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['blood_on_back', 'character.skin.blood'],
      ['blood_on_face', 'character.body.face.fluid_mess'],
      ['blood_on_shoulder', 'character.skin.blood'],
      ['bite_mark_on_shoulder', 'character.skin.scar_wound'],
      ['cum_on_back', 'explicit.sexual_fluid'],
      ['grabbed_breast_over_shoulder', 'explicit.sexual_act.general'],
      ['lipstick_mark_on_face', 'character.body.face.lips_mouth'],
      ['lipstick_mark_on_shoulder', 'character.skin.skin_mark'],
      ['mole_on_shoulder', 'character.skin.body_mole_freckle'],
      ['paizuri_on_lap', 'explicit.sexual_act.general'],
      ['penis_on_face', 'explicit.sexual_act.general'],
      ['penis_on_head', 'explicit.sexual_act.general'],
      ['penis_on_shoulder', 'explicit.sexual_act.general'],
      ['pussy_juice_on_face', 'explicit.sexual_fluid'],
      ['scar_on_head', 'character.skin.scar_wound'],
      ['scar_on_shoulder', 'character.skin.scar_wound'],
      ['snow_on_head', 'character.skin.texture_condition'],
      ['testicles_on_face', 'explicit.sexual_act.general'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
  })

  it('splits mixed body-part buckets into single-part categories', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      character: {
        body: {
          body_part: Record<string, unknown>
          face: Record<string, unknown>
        }
        skin: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['bare_shoulders', 'character.body.body_part.shoulder'],
      ['back', 'character.body.body_part.back'],
      ['thigh_gap', 'character.body.body_part.thigh'],
      ['broken_leg', 'character.body.body_part.leg'],
      ['knees', 'character.body.body_part.knee'],
      ['soles', 'character.body.body_part.foot'],
      ['toe_scrunch', 'character.body.body_part.toe'],
      ['palms', 'character.body.body_part.hand'],
      ['missing_finger', 'character.body.body_part.finger'],
      ['sharp_teeth', 'character.body.face.teeth'],
      ['fangs_out', 'character.body.face.fang'],
      ['body_blush', 'character.skin.blush'],
      ['glowing_veins', 'character.skin.vein'],
      ['sweat', 'character.skin.sweat'],
      ['oiled', 'character.skin.texture_condition'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.body.body_part).not.toHaveProperty('shoulder_back')
    expect(parsed.character.body.body_part).not.toHaveProperty('leg_thigh')
    expect(parsed.character.body.body_part).not.toHaveProperty('foot_toe')
    expect(parsed.character.body.body_part).not.toHaveProperty('hand_finger')
    expect(parsed.character.body.face).not.toHaveProperty('teeth_fang')
    expect(parsed.character.skin).not.toHaveProperty('blush_vein')
    expect(parsed.character.skin).not.toHaveProperty('sweat_oil')
    expect(parsed.character.skin).not.toHaveProperty('oil')
  })

  it('splits mixed mouth expression buckets into single-purpose categories', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      dynamics: {
        expression: {
          mouth: Record<string, unknown>
        }
      }
    }
    const expectedPaths = new Map([
      ['open_mouth', 'dynamics.expression.mouth.open'],
      ['closed_mouth', 'dynamics.expression.mouth.general'],
      ['smile', 'dynamics.expression.mouth.smile'],
      ['wrinkled_frown_(detective_pikachu)', 'dynamics.expression.mouth.frown'],
      ['biting_tongue', 'dynamics.expression.mouth.tongue_action'],
      ['saliva_trail_between_teeth', 'dynamics.expression.mouth.general'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('open_close')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('smile_frown')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('tongue_drool')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('closed')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('saliva')
  })

  it('renames broad container buckets without over-splitting their contents', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      object: {
        container: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['wine_glass', 'object.container.drinkware'],
      ['message_in_a_bottle', 'object.container.liquid_container'],
      ['rice_bowl', 'object.container.dishware'],
      ['shopping_bag', 'object.container.storage_container'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.object.container).not.toHaveProperty('cup_glass')
    expect(parsed.object.container).not.toHaveProperty('bottle_can')
    expect(parsed.object.container).not.toHaveProperty('plate_bowl')
    expect(parsed.object.container).not.toHaveProperty('box_bag')
  })

  it('reorganizes small invertebrates into clearer creature subgroups', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      creature: {
        insect_arthropod: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['mosquito', 'creature.insect_arthropod.insect'],
      ['spider', 'creature.insect_arthropod.arachnid'],
      ['centipede', 'creature.insect_arthropod.other_arthropod'],
      ['snail', 'creature.insect_arthropod.worm_mollusk'],
      ['slugcat', 'creature.insect_arthropod.misc'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.creature.insect_arthropod).not.toHaveProperty('insect_misc')
  })

  it('reorganizes meme tags by format instead of generic buckets', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      fandom: {
        meme: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['jack-o\'_challenge', 'fandom.meme.challenge_redraw'],
      ['padoru_(meme)', 'fandom.meme.character_icon'],
      ['me!me!me!_dance_(meme)', 'fandom.meme.dance_motion'],
      ['yamcha_pose_(meme)', 'fandom.meme.pose_scene'],
      ['pogchamp_(meme)', 'fandom.meme.reaction_expression'],
      ['oh?_you\'re_approaching_me?_(meme)', 'fandom.meme.quote_catchphrase'],
      ['drakeposting_(meme)', 'fandom.meme.template_macro'],
      ['114514_(meme)', 'fandom.meme.trend_meta'],
      ['pixiv_bottle_(meme)', 'fandom.meme.misc'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.fandom.meme).not.toHaveProperty('general')
    expect(parsed.fandom.meme).not.toHaveProperty('trend_meme')
  })

  it('reorganizes celestial bodies into astronomy-oriented subgroups', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      object: {
        celestial_body: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['moon', 'object.celestial_body.moon.general'],
      ['full_moon', 'object.celestial_body.moon.phase'],
      ['red_moon', 'object.celestial_body.moon.color_variant'],
      ['broken_moon', 'object.celestial_body.moon.special'],
      ['sun', 'object.celestial_body.sun.general'],
      ['solar_eclipse', 'object.celestial_body.sun.general'],
      ['star_(sky)', 'object.celestial_body.star.general'],
      ['falling_star', 'object.celestial_body.star.general'],
      ['earth_(planet)', 'object.celestial_body.planet_system.named_planet'],
      ['planetary_ring', 'object.celestial_body.planet_system.general'],
      ['gemini_(constellation)', 'object.celestial_body.constellation_asterism.zodiac'],
      ['orion_(constellation)', 'object.celestial_body.constellation_asterism.named'],
      ['big_dipper', 'object.celestial_body.constellation_asterism.general'],
      ['meteor_shower', 'object.celestial_body.small_body.general'],
      ['comet', 'object.celestial_body.small_body.general'],
      ['nebula', 'object.celestial_body.cosmic_structure.galaxy_nebula'],
      ['black_hole', 'object.celestial_body.cosmic_structure.gravity_well'],
      ['wormhole', 'object.celestial_body.cosmic_structure.gravity_well'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(Array.isArray(parsed.object.celestial_body)).toBe(false)
    expect(parsed.object.celestial_body.sun).not.toHaveProperty('eclipse')
    expect(parsed.object.celestial_body.star).not.toHaveProperty('motion')
    expect(parsed.object.celestial_body.small_body).not.toHaveProperty('shower')
  })

  it('keeps translations aligned with split pose tags and required locales', { timeout: 40000 }, () => {
    const taxonomy = readSourceYaml<Record<string, unknown>>('data/source/danbooru_tag_tree_v3.yaml')
    const translations = castTranslations(
      readSourceYaml<Record<string, unknown>>('data/source/danbooru_tag_tree_v3.multilingual.yaml'),
    )
    const categoryKeys = new Set<string>()
    const tagKeys = new Set<string>()

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            tagKeys.add(`tag.${item}`)
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        if (key === '_meta') {
          continue
        }

        const id = [...path, key].join('.')
        categoryKeys.add(`category.${id}`)
        visit(nestedValue, [...path, key])
      }
    }

    visit(taxonomy, [])

    const missingCategoryTranslations = [...categoryKeys].filter((key) => !translations[key])
    const missingTagTranslations = [...tagKeys].filter((key) => !translations[key])
    const extraCategoryTranslations = Object.keys(translations)
      .filter((key) => key.startsWith('category.'))
      .filter((key) => !categoryKeys.has(key))

    expect(missingCategoryTranslations).toEqual([])
    expect(missingTagTranslations).toEqual([])
    expect(extraCategoryTranslations).toEqual([])
    expect(readFileSync(resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml'), 'utf8')).not.toContain('\n_tags:')
    expect(tagKeys.has('tag.breasts_on_table')).toBe(true)
    expect(tagKeys.has('tag.ojou-sama_pose')).toBe(true)
    expect(tagKeys.has('tag.breasts_on_table - ojou-sama_pose')).toBe(false)
    expect(translations['category.character.affiliation.generic']?.ja).toBe('一般団体')
    expect(translations['category.fandom.character_reference']?.ja).toBe('キャラクター設定参照')
    expect(translations['category.fandom.named_reference.reference_marker']?.ja).toBe('参照マーカー')
    expect(translations['category.fandom.named_reference.phrase_reference']?.ja).toBe('定型句参照')
    expect(translations['category.fandom.named_reference.named_entry.song_title']?.ja).toBe('楽曲名')
    expect(translations['category.fandom.named_reference.named_entry.franchise_term']?.ja).toBe('作品固有名詞')
    expect(translations['category.fandom.named_reference.reference_type.title_name']?.ja).toBe('題名')
    expect(translations['category.fandom.named_reference.reference_type.entity_name']?.ja).toBe('固有名')
    expect(translations['category.fandom.named_reference.reference_type.natural_name']?.ja).toBe('自然名')
    expect(translations['category.fandom.named_reference.visual_identity']?.ja).toBe('ロゴ・エンブレム')
    expect(translations['category.fandom.named_reference.presentation_reference']?.ja).toBe('演出・表示参照')
    expect(translations['category.character.affiliation.franchise']).toBeUndefined()
    expect(translations['category.character.archetype.setting.franchise']).toBeUndefined()
    expect(translations['category.text.phrase_reference']).toBeUndefined()
    expect(translations['category.production.branding.emblem_logo']).toBeUndefined()
    expect(translations['category.apparel.garment.dress.dress']).toBeUndefined()
    expect(translations['category.creature.bird.bird']).toBeUndefined()
    expect(translations['category.creature.fantasy_creature.fantasy_creature']).toBeUndefined()
    expect(translations['category.creature.mammal.mammal']).toBeUndefined()
    expect(translations['category.fandom.affiliation']).toBeUndefined()
    expect(translations['category.action']).toBeUndefined()
    expect(translations['category.interaction']).toBeUndefined()
    expect(translations['category.pose']).toBeUndefined()
    expect(translations['category.subject']).toBeUndefined()
    expect(translations['category.character.expression']).toBeUndefined()
    expect(translations['category.object.weapon_part']).toBeUndefined()
  })

  it('keeps adjusted creature tags in the intended animal subgroups', () => {
    const parsed = readSourceYaml<{
      creature: {
        mammal: Record<string, unknown>
        aquatic: Record<string, unknown>
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['dobermann', 'creature.mammal.canine'],
      ['great_pyrenees', 'creature.mammal.canine'],
      ['german_shepherd', 'creature.mammal.canine'],
      ['pug', 'creature.mammal.canine'],
      ['chihuahua', 'creature.mammal.canine'],
      ['border_collie', 'creature.mammal.canine'],
      ['st_bernard', 'creature.mammal.canine'],
      ['serval', 'creature.mammal.feline'],
      ['scottish_fold', 'creature.mammal.feline'],
      ['calico', 'creature.mammal.feline'],
      ['prairie_dog', 'creature.mammal.general'],
      ['sea_lion', 'creature.mammal.general'],
      ['seal_(animal)', 'creature.mammal.general'],
      ['walrus', 'creature.mammal.general'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.creature.aquatic).not.toHaveProperty('marine_mammal')
  })

  it('separates collective group-shape tags from strict character counts', () => {
    const parsed = readSourceYaml<{
      character: {
        demographic: Record<string, unknown>
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['1girl', 'character.demographic.count'],
      ['2boys', 'character.demographic.count'],
      ['quintuplets', 'character.demographic.count'],
      ['everyone', 'character.demographic.collective'],
      ['people', 'character.demographic.collective'],
      ['crowd', 'character.demographic.collective'],
      ['too_many', 'character.demographic.collective'],
      ['absolutely_everyone', 'character.demographic.collective'],
      ['fleet', 'character.demographic.collective'],
      ['audience', 'character.demographic.collective'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.demographic).toHaveProperty('collective')
  })

  it('keeps identity and fusion tags out of raw headcount buckets', () => {
    const parsed = readSourceYaml<{
      character: {
        demographic: Record<string, unknown>
      }
      fandom: {
        narrative_meta: {
          crossover: string[]
        }
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['character_single', 'character.demographic.identity_count'],
      ['multiple_traps', 'character.demographic.gender_presentation.feminine_male'],
      ['multiple_fusions', 'fandom.narrative_meta.crossover'],
      ['trap', 'character.demographic.gender_presentation.feminine_male'],
      ['fusion', 'fandom.narrative_meta.crossover'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.demographic).toHaveProperty('identity_count')
  })

  it('separates subject presence tags from strict headcount', () => {
    const parsed = readSourceYaml<{
      character: {
        demographic: Record<string, unknown>
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['1girl', 'character.demographic.count'],
      ['multiple_boys', 'character.demographic.count'],
      ['solo', 'character.demographic.presence'],
      ['solo_focus', 'character.demographic.presence'],
      ['no_humans', 'character.demographic.presence'],
      ['character_single', 'character.demographic.identity_count'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.demographic).toHaveProperty('presence')
  })

  it('separates subject focus and depiction tags from gender presentation', () => {
    const parsed = readSourceYaml<{
      character: {
        demographic: Record<string, unknown>
        archetype: {
          form: Record<string, unknown>
        }
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['male_focus', 'character.demographic.focus'],
      ['faceless_male', 'character.demographic.depiction'],
      ['faceless_female', 'character.demographic.depiction'],
      ['androgynous', 'character.demographic.gender_presentation.neutral'],
      ['ambiguous_gender', 'character.demographic.gender_presentation.neutral'],
      ['trap', 'character.demographic.gender_presentation.feminine_male'],
      ['otoko_no_ko', 'character.demographic.gender_presentation.feminine_male'],
      ['multiple_traps', 'character.demographic.gender_presentation.feminine_male'],
      ['tomboy', 'character.demographic.gender_presentation.masculine_female'],
      ['reverse_trap', 'character.demographic.gender_presentation.masculine_female'],
      ['genderswap', 'character.demographic.gender_presentation.transformation'],
      ['crossdressing_(mtf)', 'character.demographic.gender_presentation.transformation'],
      ['bara', 'character.demographic.gender_presentation.male_style'],
      ['bishounen', 'character.demographic.gender_presentation.male_style'],
      ['furry_female', 'character.archetype.form.female'],
      ['furry_male', 'character.archetype.form.male'],
      ['fujoshi', 'character.archetype.identity.social_type'],
      ['himejoshi', 'character.archetype.identity.social_type'],
      ['himedanshi', 'character.archetype.identity.social_type'],
      ['bisexual_male', 'character.archetype.identity.social_type'],
      ['implied_bisexual', 'character.archetype.identity.social_type'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.demographic).toHaveProperty('focus')
    expect(parsed.character.demographic).toHaveProperty('depiction')
    expect(parsed.character.demographic).toHaveProperty('gender_presentation')
    expect(parsed.character.archetype.form).toHaveProperty('female')
    expect(parsed.character.archetype.form).toHaveProperty('male')
  })

  it('splits age stage tags from age changes and age relations', () => {
    const parsed = readSourceYaml<{
      character: {
        demographic: {
          age: Record<string, unknown>
        }
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['loli', 'character.demographic.age.stage'],
      ['shota', 'character.demographic.age.stage'],
      ['teenage', 'character.demographic.age.stage'],
      ['lost_child', 'character.demographic.age.stage'],
      ['aged_down', 'character.demographic.age.change'],
      ['age_progression', 'character.demographic.age.change'],
      ['age_difference', 'character.demographic.age.relation'],
      ['age_comparison', 'character.demographic.age.relation'],
      ['character_age', 'character.demographic.age.metadata'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.demographic.age).toHaveProperty('stage')
    expect(parsed.character.demographic.age).toHaveProperty('change')
    expect(parsed.character.demographic.age).toHaveProperty('relation')
    expect(parsed.character.demographic.age).toHaveProperty('metadata')
  })

  it('splits altered nonhuman body traits away from mechanization-only buckets', () => {
    const parsed = readSourceYaml<{
      character: {
        nonhuman_trait: Record<string, unknown>
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['material_growth', 'character.nonhuman_trait.altered_body.material_growth'],
      ['core_crystal_(xenoblade)', 'character.nonhuman_trait.altered_body.material_growth'],
      ['gem_(steven_universe)', 'character.nonhuman_trait.altered_body.material_growth'],
      ['colored_extremities', 'character.nonhuman_trait.altered_body.surface_change'],
      ['see-through_body', 'character.nonhuman_trait.altered_body.surface_change'],
      ['mechanization', 'character.nonhuman_trait.altered_body.mechanization'],
      ['mechanical_spine', 'character.nonhuman_trait.altered_body.mechanization'],
      ['body_horror', 'character.nonhuman_trait.altered_body.mutation'],
      ['kagune_(tokyo_ghoul)', 'character.nonhuman_trait.altered_body.mutation'],
      ['chest_tuft', 'character.nonhuman_trait.fur'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.nonhuman_trait).toHaveProperty('altered_body')
    expect(parsed.character.nonhuman_trait).not.toHaveProperty('synthetic_mutation')
    expect(parsed.character.nonhuman_trait.altered_body).toHaveProperty('surface_change')
  })

  it('flattens redundant repeated-name wrappers in selected branches', () => {
    const parsed = readSourceYaml<{
      apparel: {
        garment: {
          dress: Record<string, unknown>
        }
      }
      creature: {
        mammal: Record<string, unknown>
        bird: Record<string, unknown>
        fantasy_creature: Record<string, unknown>
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['dress', 'apparel.garment.dress.general'],
      ['wedding_dress', 'apparel.garment.dress.general'],
      ['rabbit', 'creature.mammal.general'],
      ['sea_lion', 'creature.mammal.general'],
      ['bird', 'creature.bird.general'],
      ['penguin', 'creature.bird.general'],
      ['angel', 'creature.fantasy_creature.general'],
      ['abyssal_ship', 'creature.fantasy_creature.general'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.apparel.garment.dress).toHaveProperty('general')
    expect(parsed.creature.mammal).toHaveProperty('general')
    expect(parsed.creature.bird).toHaveProperty('general')
    expect(parsed.creature.fantasy_creature).toHaveProperty('general')
    expect(parsed.apparel.garment.dress).not.toHaveProperty('dress')
    expect(parsed.creature.mammal).not.toHaveProperty('mammal')
    expect(parsed.creature.bird).not.toHaveProperty('bird')
    expect(parsed.creature.fantasy_creature).not.toHaveProperty('fantasy_creature')
  })

  it('keeps aquatic and fandom group tags in clearer buckets', () => {
    const parsed = readSourceYaml<{
      creature: {
        aquatic: Record<string, unknown>
      }
      fandom: {
        franchise_meta: {
          general: string[]
          franchise_misc: string[]
        }
        group_tag: string[]
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['eel', 'creature.aquatic.fish_marine'],
      ['carp', 'creature.aquatic.fish_marine'],
      ['moorish_idol', 'creature.aquatic.fish_marine'],
      ['regal_blue_tang', 'creature.aquatic.fish_marine'],
      ['yellow_tang', 'creature.aquatic.fish_marine'],
      ['lobster', 'creature.aquatic.aquatic_misc'],
      ['sea_anemone', 'creature.aquatic.aquatic_misc'],
      ['holomyth', 'fandom.group_tag'],
      ['team_9_(touhou)', 'fandom.group_tag'],
      ['arius_squad_(blue_archive)', 'fandom.group_tag'],
      ['team_rainbow_rocket', 'fandom.group_tag'],
      ['team_skull', 'fandom.group_tag'],
      ['team_magma', 'fandom.group_tag'],
      ['full-stop_office_(identity)_(project_moon)', 'fandom.group_tag'],
      ['chrysos_heirs_(honkai:_star_rail)', 'fandom.group_tag'],
      ['defy_(girls\'_frontline)', 'fandom.group_tag'],
      ['the_children_(zettai_karen_children)', 'fandom.group_tag'],
      ['gap_(touhou)', 'fandom.franchise_meta.franchise_misc'],
      ['devil_fruit_power', 'fandom.franchise_meta.franchise_misc'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.fandom.franchise_meta.general).not.toContain('holomyth')
    expect(parsed.fandom.franchise_meta.general).not.toContain('team_9_(touhou)')
    expect(parsed.fandom.franchise_meta.general).not.toContain('team_rainbow_rocket')
    expect(parsed.fandom.franchise_meta.franchise_misc).not.toContain('team_skull')
    expect(parsed.fandom.franchise_meta.franchise_misc).not.toContain('team_magma')
    expect(parsed.fandom.franchise_meta.franchise_misc).not.toContain('full-stop_office_(identity)_(project_moon)')
    expect(parsed.fandom.franchise_meta.franchise_misc).not.toContain('chrysos_heirs_(honkai:_star_rail)')
    expect(parsed.fandom.franchise_meta.franchise_misc).not.toContain('defy_(girls\'_frontline)')
  })

  it('keeps franchise-specific character and reference tags under fandom', () => {
    const parsed = readSourceYaml<{
      apparel: {
        detail: {
          detail: {
            other: Record<string, unknown>
          }
        }
      }
      character: {
        affiliation: Record<string, unknown>
        archetype: {
          setting: Record<string, unknown>
        }
      }
      fandom: {
        character_reference: string[]
        franchise_meta: {
          general: string[]
        }
        group_tag: string[]
        named_reference: {
          named_entry: Record<string, unknown>
          phrase_reference: string[]
          presentation_reference: string[]
          reference_marker: string[]
          reference_type: Record<string, unknown>
          visual_identity: string[]
        }
        named_object_reference: {
          costume: string[]
        }
        narrative_meta: {
          crossover: string[]
        }
      }
      production: {
        authorship: string[]
        art_style: {
          general: string[]
        }
        branding: {
          brand_logo: string[]
          label_reference: string[]
        }
        format: {
          general: string[]
        }
      }
      text: {
        text_content: {
          dialogue_meta: string[]
        }
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['saiyan', 'fandom.character_reference'],
      ['miqo\'te', 'fandom.character_reference'],
      ['jedi', 'fandom.character_reference'],
      ['team_rocket', 'fandom.group_tag'],
      ['sanbaka_(nijisanji)', 'fandom.group_tag'],
      ['source_quote', 'fandom.named_reference.phrase_reference'],
      ['kotoyoro', 'fandom.named_reference.phrase_reference'],
      ['copyright_name', 'fandom.named_reference.reference_type.title_name'],
      ['song_name', 'fandom.named_reference.reference_type.title_name'],
      ['character_name', 'fandom.named_reference.reference_type.entity_name'],
      ['place_name', 'fandom.named_reference.reference_type.entity_name'],
      ['ship_name', 'fandom.named_reference.reference_type.entity_name'],
      ['animal_name', 'fandom.named_reference.reference_type.natural_name'],
      ['plant_name', 'fandom.named_reference.reference_type.natural_name'],
      ['scientific_name', 'fandom.named_reference.reference_type.natural_name'],
      ['copyright_notice', 'fandom.named_reference.reference_marker'],
      ['copyright_logo', 'fandom.named_reference.reference_marker'],
      ['artist_self-reference', 'fandom.named_reference.reference_marker'],
      ['snow_halation', 'fandom.named_reference.named_entry.song_title'],
      ['shikairo_days', 'fandom.named_reference.named_entry.song_title'],
      ['tracen_academy', 'fandom.named_reference.named_entry.franchise_term'],
      ['amphoreus_(honkai:_star_rail)', 'fandom.named_reference.named_entry.franchise_term'],
      ['heartsteel_(league_of_legends)', 'fandom.named_reference.named_entry.franchise_term'],
      ['chaldea_logo', 'fandom.named_reference.visual_identity'],
      ['rhodes_island_logo_(arknights)', 'fandom.named_reference.visual_identity'],
      ['nerv', 'fandom.named_reference.visual_identity'],
      ['team_star', 'fandom.named_reference.visual_identity'],
      ['royal_navy_emblem_(azur_lane)', 'fandom.named_reference.visual_identity'],
      ['akira_movie_poster', 'fandom.named_reference.presentation_reference'],
      ['ttgl_eyecatch', 'fandom.named_reference.presentation_reference'],
      ['recruitment_(blue_archive)', 'fandom.named_reference.presentation_reference'],
      ['twitter_strip_game', 'fandom.named_reference.presentation_reference'],
      ['srw_battle_screen', 'fandom.named_reference.presentation_reference'],
      ['official_alternate_costume', 'fandom.named_object_reference.costume'],
      ['official_art_inset', 'fandom.franchise_meta.general'],
      ['style_parody', 'fandom.narrative_meta.crossover'],
      ['multiple_style_parody', 'fandom.narrative_meta.crossover'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.fandom).toHaveProperty('character_reference')
    expect(parsed.character.affiliation).not.toHaveProperty('franchise')
    expect(parsed.character.archetype.setting).not.toHaveProperty('franchise')
    expect(parsed.fandom.named_reference).toHaveProperty('named_entry')
    expect(parsed.fandom.named_reference).toHaveProperty('reference_type')
    expect(parsed.fandom.named_reference.named_entry).toHaveProperty('song_title')
    expect(parsed.fandom.named_reference.named_entry).toHaveProperty('franchise_term')
    expect(parsed.fandom.named_reference.reference_type).toHaveProperty('title_name')
    expect(parsed.fandom.named_reference.reference_type).toHaveProperty('entity_name')
    expect(parsed.fandom.named_reference.reference_type).toHaveProperty('natural_name')
    expect(parsed.apparel.detail.detail.other).not.toHaveProperty('costume_change')
    expect(parsed.text).not.toHaveProperty('phrase_reference')
    expect(parsed.text.text_content.dialogue_meta).not.toContain('source_quote')
    expect(parsed.production.authorship).not.toContain('copyright_notice')
    expect(parsed.production.authorship).not.toContain('artist_self-reference')
    expect(parsed.production.branding.brand_logo).not.toContain('copyright_logo')
    expect(parsed.production.branding.brand_logo).not.toContain('chaldea_logo')
    expect(parsed.production.branding.brand_logo).not.toContain('penguin_logistics_logo')
    expect(parsed.production.branding).not.toHaveProperty('emblem_logo')
    expect(parsed.production.branding.label_reference).not.toContain('team_star')
    expect(parsed.production.branding.label_reference).not.toContain('team_galactic')
    expect(parsed.production.branding.label_reference).not.toContain('royal_navy_emblem_(azur_lane)')
    expect(parsed.production.format.card_medium).not.toContain('akira_movie_poster')
    expect(parsed.production.format.general).not.toContain('ttgl_eyecatch')
    expect(parsed.production.format.general).not.toContain('recruitment_(blue_archive)')
    expect(parsed.production.format.general).not.toContain('twitter_strip_game')
    expect(parsed.production.format.general).not.toContain('srw_battle_screen')
    expect(parsed.production.format.general).not.toContain('official_art_inset')
    expect(parsed.production.art_style.general).not.toContain('style_parody')
    expect(parsed.production.art_style.general).not.toContain('multiple_style_parody')
  })

  it('keeps adjusted apparel detail tags in matching detail buckets', () => {
    const parsed = readSourceYaml<{
      apparel: {
        detail: Record<string, unknown>
      }
    }>('data/source/danbooru_tag_tree_v3.yaml')
    const expectedPaths = new Map([
      ['gold_trim', 'apparel.detail.detail.trim_frill'],
      ['fold-over_collar', 'apparel.detail.detail.collar_neckline'],
      ['double-breasted', 'apparel.detail.detail.fastener'],
      ['multiple_belts', 'apparel.detail.detail.other.structural'],
      ['multiple_thigh_straps', 'apparel.detail.detail.other.structural'],
      ['multiple_straps', 'apparel.detail.detail.other.structural'],
      ['two-tone_belt', 'apparel.detail.detail.other.structural'],
      ['multicolored_bow', 'apparel.detail.detail.other.decorative'],
      ['multiple_bows', 'apparel.detail.detail.other.decorative'],
      ['gold_embroidery', 'apparel.detail.detail.other.decorative'],
      ['multiple_hat_bows', 'apparel.detail.detail.other.decorative'],
      ['see-through_bow', 'apparel.detail.detail.other.decorative'],
      ['translucent', 'apparel.detail.detail.material_layer'],
      ['mesh', 'apparel.detail.detail.material_layer'],
    ])
    const rows = collectMatchingTagPaths(parsed, expectedPaths)

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect((parsed.apparel.detail.detail as Record<string, unknown>)).not.toHaveProperty('damage_wear')
  })
})
