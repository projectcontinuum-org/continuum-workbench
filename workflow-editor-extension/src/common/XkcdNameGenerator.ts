/**
 * Pure xkcd-style memorable name generator: PascalCase `{Adjective}{Noun}{Number}`
 * (e.g. `GreenOtter37`). Alphanumeric only — no spaces, hyphens, slashes or dots — so a
 * generated name is a valid literal safe to embed in a stored schedule path. No DOM or
 * Theia imports, so it runs under `node --test` (see XkcdNameGenerator.spec.ts).
 */

const ADJECTIVES = [
    'amber', 'arctic', 'autumn', 'azure', 'bright', 'calm', 'cedar', 'coral', 'cosmic',
    'crimson', 'crystal', 'dapper', 'daring', 'dusk', 'eager', 'ember', 'fancy', 'fierce',
    'foggy', 'frosty', 'gentle', 'glad', 'golden', 'grassy', 'green', 'happy', 'harbor',
    'hidden', 'humble', 'icy', 'indigo', 'ivory', 'jade', 'jolly', 'jumpy', 'kind', 'lavender',
    'lively', 'lucky', 'marble', 'misty', 'mossy', 'muted', 'nimble', 'noble', 'oaken',
    'ocean', 'olive', 'opal', 'pale', 'peppy', 'plum', 'polar', 'proud', 'purple', 'quartz',
    'quiet', 'rapid', 'raspy', 'red', 'rocky', 'rosy', 'round', 'royal', 'rusty', 'sandy',
    'scarlet', 'shy', 'silky', 'silver', 'slate', 'snowy', 'solar', 'spicy', 'spring',
    'stable', 'steady', 'sunny', 'swift', 'teal', 'thirsty', 'tidy', 'timid', 'topaz', 'vivid',
    'warm', 'wavy', 'wheat', 'wise', 'witty', 'yellow', 'zen',
];

const NOUNS = [
    'adder', 'applet', 'arrow', 'axolotl', 'badger', 'banyan', 'beacon', 'birch', 'bison',
    'bobcat', 'bramble', 'breeze', 'buffalo', 'bulbul', 'butter', 'cactus', 'camel', 'canyon',
    'cardinal', 'cedar', 'cheetah', 'chipmunk', 'cobra', 'comet', 'condor', 'coral', 'cougar',
    'coyote', 'crane', 'cricket', 'dolphin', 'durian', 'eagle', 'echo', 'ermine', 'falcon',
    'ferret', 'finch', 'firefly', 'fox', 'gazelle', 'gecko', 'geyser', 'glacier', 'gorge',
    'grouse', 'guppy', 'harbor', 'hare', 'hawk', 'heron', 'ibex', 'iguana', 'jackal', 'jaguar',
    'jasper', 'kangaroo', 'kingfisher', 'kite', 'koala', 'krill', 'lagoon', 'lama', 'lantern',
    'lemur', 'leopard', 'lion', 'lobster', 'magnet', 'mango', 'maple', 'marlin', 'meadow',
    'meteor', 'minnow', 'mole', 'monkey', 'moose', 'mushroom', 'narwhal', 'nebula', 'newt',
    'nighthawk', 'ocelot', 'octopus', 'opal', 'otter', 'owl', 'panda', 'panther', 'parrot',
    'pebble', 'penguin', 'phoenix', 'pigeon', 'pika', 'polar', 'pony', 'puffin', 'puma',
    'quail', 'quartz', 'rabbit', 'raccoon', 'raven', 'reef', 'robin', 'sable', 'salmon',
    'sapphire', 'seal', 'shark', 'shrub', 'skunk', 'sloth', 'snail', 'sparrow', 'spruce',
    'squid', 'starling', 'stork', 'sunfish', 'swallow', 'swan', 'swift', 'tapir', 'tiger',
    'topaz', 'tortoise', 'toucan', 'trout', 'turkey', 'turtle', 'unicorn', 'viper', 'vulture',
    'walrus', 'wasp', 'weasel', 'whale', 'willow', 'wolf', 'wombat', 'yak', 'zebra',
];

function pick<T>(list: readonly T[]): T {
    return list[Math.floor(Math.random() * list.length)];
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A memorable, alphanumeric-only name like `GreenOtter37`. */
export function generateXkcdName(): string {
    const number = Math.floor(Math.random() * 100);
    return `${capitalize(pick(ADJECTIVES))}${capitalize(pick(NOUNS))}${number}`;
}
