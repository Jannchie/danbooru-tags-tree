import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

import { buildDataset, castTranslations, formatSlug } from '@/utils/taxonomy'

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

  it('keeps selected head and shoulder anchor tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['animal_on_head', 'composition.framing.body_part_anchor.head'],
      ['book_on_head', 'composition.framing.body_part_anchor.head'],
      ['on_head', 'composition.framing.body_part_anchor.head'],
      ['animal_on_shoulder', 'composition.framing.body_part_anchor.shoulder.on_shoulder'],
      ['on_shoulder', 'composition.framing.body_part_anchor.shoulder.on_shoulder'],
      ['hands_on_shoulders', 'composition.framing.body_part_anchor.shoulder.on_shoulders'],
      ['arm_over_shoulder', 'composition.framing.body_part_anchor.shoulder.over_shoulder'],
      ['holding_over_opposite_shoulder', 'composition.framing.body_part_anchor.shoulder.over_shoulder'],
      ['arm_around_shoulder', 'composition.framing.body_part_anchor.shoulder.around_shoulder'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: path.join('.') })
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
            rows.push({ tag: item, path: path.join('.') })
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
            rows.push({ tag: item, path: path.join('.') })
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

  it('keeps selected headwear relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['adjusting_headwear', 'apparel.headwear.state.interaction'],
      ['cum_on_headwear', 'apparel.headwear.state.on_headwear'],
      ['eyewear_on_headwear', 'apparel.headwear.state.on_headwear'],
      ['goggles_on_headwear', 'apparel.headwear.state.on_headwear'],
      ['hand_on_headwear', 'apparel.headwear.state.interaction'],
      ['hands_on_headwear', 'apparel.headwear.state.interaction'],
      ['headphones_over_headwear', 'apparel.headwear.state.over_headwear'],
      ['headwear_switch', 'apparel.headwear.state.interaction'],
      ['putting_on_headwear', 'apparel.headwear.state.interaction'],
      ['snow_on_headwear', 'apparel.headwear.state.on_headwear'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: path.join('.') })
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
      ['shirt_behind_neck', 'apparel.body_part_placement.neck.behind_neck'],
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
            rows.push({ tag: item, path: path.join('.') })
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
            rows.push({ tag: item, path: path.join('.') })
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
      ['belt_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['cardigan_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['clothes_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['jacket_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['jumpsuit_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['rope_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['shirt_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['sweater_around_waist', 'apparel.body_part_placement.waist.around_waist'],
      ['towel_around_waist', 'apparel.body_part_placement.waist.around_waist'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: path.join('.') })
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
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['bandaid_on_head', 'apparel.body_part_placement.head.on_head'],
      ['bra_on_head', 'apparel.body_part_placement.head.on_head'],
      ['diving_mask_on_head', 'apparel.body_part_placement.head.on_head'],
      ['eyewear_on_head', 'apparel.body_part_placement.head.on_head'],
      ['goggles_on_head', 'apparel.body_part_placement.head.on_head'],
      ['mask_on_head', 'apparel.body_part_placement.head.on_head'],
      ['necktie_on_head', 'apparel.body_part_placement.head.on_head'],
      ['ofuda_on_head', 'apparel.body_part_placement.head.on_head'],
      ['panties_on_head', 'apparel.body_part_placement.head.on_head'],
      ['scarf_on_head', 'apparel.body_part_placement.head.on_head'],
      ['towel_on_head', 'apparel.body_part_placement.head.on_head'],
      ['bandage_on_face', 'apparel.body_part_placement.face.on_face'],
      ['bandaid_on_face', 'apparel.body_part_placement.face.on_face'],
      ['gauze_on_face', 'apparel.body_part_placement.face.on_face'],
      ['sticker_on_face', 'apparel.body_part_placement.face.on_face'],
      ['bandaid_on_shoulder', 'apparel.body_part_placement.shoulder.on_shoulder'],
      ['cardigan_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['clothes_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['coat_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['haori_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['jacket_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['kimono_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['shirt_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['jacket_over_shoulder', 'apparel.body_part_placement.shoulder.over_shoulder'],
      ['bandaid_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['gauze_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['sticker_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['towel_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['bandana_around_arm', 'apparel.body_part_placement.arm.around_arm'],
      ['chain_around_arm', 'apparel.body_part_placement.arm.around_arm'],
      ['bandaid_on_chest', 'apparel.body_part_placement.chest.on_chest'],
      ['flower_on_chest', 'apparel.body_part_placement.chest.on_chest'],
      ['bandaid_on_foot', 'apparel.body_part_placement.foot.on_foot'],
      ['bandaid_on_hand', 'apparel.body_part_placement.hand.on_hand'],
      ['bandaid_on_knee', 'apparel.body_part_placement.knee.on_knee'],
      ['bandage_on_knee', 'apparel.body_part_placement.knee.on_knee'],
      ['gauze_on_knee', 'apparel.body_part_placement.knee.on_knee'],
      ['bandaid_on_leg', 'apparel.body_part_placement.leg.on_leg'],
      ['bandage_on_leg', 'apparel.body_part_placement.leg.on_leg'],
      ['gauze_on_leg', 'apparel.body_part_placement.leg.on_leg'],
      ['ofuda_on_leg', 'apparel.body_part_placement.leg.on_leg'],
      ['sticker_on_leg', 'apparel.body_part_placement.leg.on_leg'],
      ['bandaid_on_stomach', 'apparel.body_part_placement.stomach.on_stomach'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: path.join('.') })
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
            rows.push({ tag: item, path: path.join('.') })
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
      ['oiled', 'character.skin.oil'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: path.join('.') })
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
      ['closed_mouth', 'dynamics.expression.mouth.closed'],
      ['smile', 'dynamics.expression.mouth.smile'],
      ['wrinkled_frown_(detective_pikachu)', 'dynamics.expression.mouth.frown'],
      ['biting_tongue', 'dynamics.expression.mouth.tongue_action'],
      ['saliva_trail_between_teeth', 'dynamics.expression.mouth.saliva'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: path.join('.') })
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
            rows.push({ tag: item, path: path.join('.') })
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
            rows.push({ tag: item, path: path.join('.') })
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
            rows.push({ tag: item, path: path.join('.') })
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
      ['solar_eclipse', 'object.celestial_body.sun.eclipse'],
      ['star_(sky)', 'object.celestial_body.star.general'],
      ['falling_star', 'object.celestial_body.star.motion'],
      ['earth_(planet)', 'object.celestial_body.planet_system.named_planet'],
      ['planetary_ring', 'object.celestial_body.planet_system.general'],
      ['gemini_(constellation)', 'object.celestial_body.constellation_asterism.zodiac'],
      ['orion_(constellation)', 'object.celestial_body.constellation_asterism.named'],
      ['big_dipper', 'object.celestial_body.constellation_asterism.general'],
      ['meteor_shower', 'object.celestial_body.small_body.shower'],
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
            rows.push({ tag: item, path: path.join('.') })
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
  })
})
