// Site settings live in the `settings` table as key/value rows.
// Anything not stored falls back to these defaults, so the brand name and
// every piece of copy can be changed later from Admin > Settings.

export const DEFAULTS = {
  brand_name: 'NOUÉ',
  tagline: 'Hand-crocheted bag charms and keyrings',
  meta_description:
    'Hand-crocheted bag charms and keyrings, made in small batches from cotton and merino wool.',
  currency: 'USD',

  hero_title: 'Charms, crocheted by hand.',
  hero_text: 'Small-batch bag charms and keyrings, made one stitch at a time.',
  hero_image: '',

  about_title: 'Made slowly, one loop at a time',
  about_body: [
    'Every charm starts as a single strand of yarn and a 2 mm hook. There are no moulds and no machines, so no two pieces come out exactly alike.',
    'We work in small batches with mercerised cotton and merino wool, and finish each piece with solid brass hardware that is made to be clipped on, taken off and passed along.',
    'When a batch is gone, it is gone. New pieces are added a few at a time.',
  ].join('\n\n'),

  shipping_note:
    'Each piece is made to order in small batches. Write to us for availability, delivery times and shipping costs to your country.',
  contact_email: '',
  instagram_url: '',
  footer_note: '',
};

export const SETTING_KEYS = Object.keys(DEFAULTS);

export function mergeSettings(rows = []) {
  const settings = { ...DEFAULTS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}
