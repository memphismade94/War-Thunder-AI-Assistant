import unittest

from scripts.scrape_wt import chunk, classify, normalize


class ScraperTests(unittest.TestCase):
    def test_normalize_rejects_external_hosts(self):
        self.assertIsNone(normalize('https://example.com/unit/test'))

    def test_normalize_removes_tracking_query(self):
        self.assertEqual(
            normalize('https://wiki.warthunder.com/unit/ussr_t_62?foo=bar'),
            'https://wiki.warthunder.com/unit/ussr_t_62',
        )

    def test_classify_paths(self):
        self.assertEqual(classify('https://wiki.warthunder.com/unit/us_m1_abrams', 'general'), 'vehicle')
        self.assertEqual(classify('https://wiki.warthunder.com/weapon/2544-tank-ammunition', 'general'), 'ammunition')
        self.assertEqual(classify('https://wiki.warthunder.com/mechanics/242-armour', 'general'), 'mechanics')
        self.assertEqual(classify('https://wiki.warthunder.com/gamemode/realistic_battles', 'general'), 'gamemode')

    def test_chunk_has_overlap_and_preserves_text(self):
        text = 'Sentence one. ' * 300
        chunks = chunk(text, size=300, overlap=50)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunks))
        self.assertIn('Sentence one.', chunks[0])


if __name__ == '__main__':
    unittest.main()
