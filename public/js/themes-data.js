const chatThemes = [
    {
        id: "classic_doodle",
        name: "Classic Doodle",
        category: "default",
        bgColor: "#0b141a",
        pattern: "/patterns/doodle-grey.svg",
        patternOpacity: 0.08,
        bubbleSent: "#ff2d55",
        bubbleReceived: "#202c33",
        textColor: "#ffffff",
        secondaryText: "#8696a0",
        inputBg: "#2a3942"
    },
    // SOFT THEMES (10)
    {
        id: "soft_peach",
        name: "Soft Peach",
        category: "soft",
        bgColor: "#fff5ee",
        bubbleSent: "#fadadd",
        bubbleReceived: "#ffffff",
        textColor: "#5e4e4e",
        secondaryText: "#8a7e7e",
        inputBg: "#ffffff"
    },
    {
        id: "lavender_mist",
        name: "Lavender Mist",
        category: "soft",
        bgColor: "#e6e6fa",
        bubbleSent: "#d8bfd8",
        bubbleReceived: "#ffffff",
        textColor: "#4b0082",
        secondaryText: "#6a5acd",
        inputBg: "#ffffff"
    },
    {
        id: "mint_calm",
        name: "Mint Calm",
        category: "soft",
        bgColor: "#f5fffa",
        bubbleSent: "#98fb98",
        bubbleReceived: "#ffffff",
        textColor: "#2e8b57",
        secondaryText: "#3cb371",
        inputBg: "#ffffff"
    },
    {
        id: "baby_blue_fade",
        name: "Baby Blue Fade",
        category: "soft",
        bgColor: "#f0f8ff",
        bubbleSent: "#b0e0e6",
        bubbleReceived: "#ffffff",
        textColor: "#4682b4",
        secondaryText: "#5f9ea0",
        inputBg: "#ffffff"
    },
    {
        id: "warm_sand",
        name: "Warm Sand",
        category: "soft",
        bgColor: "#f5f5dc",
        bubbleSent: "#deb887",
        bubbleReceived: "#ffffff",
        textColor: "#8b4513",
        secondaryText: "#a0522d",
        inputBg: "#ffffff"
    },
    {
        id: "blush_pink",
        name: "Blush Pink",
        category: "soft",
        bgColor: "#fff0f5",
        bubbleSent: "#ffb6c1",
        bubbleReceived: "#ffffff",
        textColor: "#c71585",
        secondaryText: "#db7093",
        inputBg: "#ffffff"
    },
    {
        id: "cool_grey_soft",
        name: "Cool Grey Soft",
        category: "soft",
        bgColor: "#f8f8f8",
        bubbleSent: "#d3d3d3",
        bubbleReceived: "#ffffff",
        textColor: "#333333",
        secondaryText: "#777777",
        inputBg: "#ffffff"
    },
    {
        id: "pale_aqua",
        name: "Pale Aqua",
        category: "soft",
        bgColor: "#e0ffff",
        bubbleSent: "#afeeee",
        bubbleReceived: "#ffffff",
        textColor: "#008b8b",
        secondaryText: "#20b2aa",
        inputBg: "#ffffff"
    },
    {
        id: "light_rose",
        name: "Light Rose",
        category: "soft",
        bgColor: "#fff5f5",
        bubbleSent: "#ffe4e1",
        bubbleReceived: "#ffffff",
        textColor: "#cd5c5c",
        secondaryText: "#f08080",
        inputBg: "#ffffff"
    },
    {
        id: "cream_white",
        name: "Cream White",
        category: "soft",
        bgColor: "#fffdd0",
        bubbleSent: "#f5f5f5",
        bubbleReceived: "#ffffff",
        textColor: "#5d5d5d",
        secondaryText: "#8b8b8b",
        inputBg: "#ffffff"
    },
    // HARD THEMES (10)
    {
        id: "pure_bw",
        name: "Pure B&W",
        category: "hard",
        bgColor: "#000000",
        bubbleSent: "#ffffff",
        bubbleReceived: "#1a1a1a",
        textColor: "#ffffff",
        secondaryText: "#888888",
        inputBg: "#1a1a1a"
    },
    {
        id: "midnight_neon",
        name: "Midnight Neon",
        category: "hard",
        bgColor: "#000033",
        bubbleSent: "#00ffff",
        bubbleReceived: "#000066",
        textColor: "#ffffff",
        secondaryText: "#00cccc",
        inputBg: "#000044"
    },
    {
        id: "red_alert",
        name: "Red Alert",
        category: "hard",
        bgColor: "#000000",
        bubbleSent: "#ff0000",
        bubbleReceived: "#330000",
        textColor: "#ffffff",
        secondaryText: "#ff4444",
        inputBg: "#220000"
    },
    {
        id: "cyber_dark",
        name: "Cyber Dark",
        category: "hard",
        bgColor: "#0d0208",
        bubbleSent: "#00ff41",
        bubbleReceived: "#003b00",
        textColor: "#ffffff",
        secondaryText: "#008f11",
        inputBg: "#001100"
    },
    {
        id: "steel_contrast",
        name: "Steel Contrast",
        category: "hard",
        bgColor: "#121212",
        bubbleSent: "#b0c4de",
        bubbleReceived: "#2f4f4f",
        textColor: "#ffffff",
        secondaryText: "#778899",
        inputBg: "#1e1e1e"
    },
    {
        id: "dark_pro",
        name: "Dark Mode Pro",
        category: "hard",
        bgColor: "#1a1a1a",
        bubbleSent: "#00a884",
        bubbleReceived: "#2a2a2a",
        textColor: "#ffffff",
        secondaryText: "#8696a0",
        inputBg: "#252525"
    },
    {
        id: "obsidian_glow",
        name: "Obsidian Glow",
        category: "hard",
        bgColor: "#0b0b0b",
        bubbleSent: "#a020f0",
        bubbleReceived: "#1f1f1f",
        textColor: "#ffffff",
        secondaryText: "#d8bfd8",
        inputBg: "#181818"
    },
    {
        id: "graphite_sharp",
        name: "Graphite Sharp",
        category: "hard",
        bgColor: "#1c1c1c",
        bubbleSent: "#333333",
        bubbleReceived: "#2c2c2c",
        textColor: "#e1e1e1",
        secondaryText: "#a0a0a0",
        inputBg: "#252525"
    },
    {
        id: "ice_contrast",
        name: "Ice Contrast",
        category: "hard",
        bgColor: "#000000",
        bubbleSent: "#e0ffff",
        bubbleReceived: "#121212",
        textColor: "#ffffff",
        secondaryText: "#afeeee",
        inputBg: "#1a1a1a"
    },
    {
        id: "deep_violet",
        name: "Deep Violet",
        category: "hard",
        bgColor: "#120024",
        bubbleSent: "#bf00ff",
        bubbleReceived: "#240046",
        textColor: "#ffffff",
        secondaryText: "#9d4edd",
        inputBg: "#1a0033"
    },
    // BRIGHT THEMES (10)
    {
        id: "neon_pink",
        name: "Neon Pink",
        category: "bright",
        bgColor: "#ff1493",
        bubbleSent: "#ffffff",
        bubbleReceived: "#ff69b4",
        textColor: "#ffffff",
        secondaryText: "#ffc0cb",
        inputBg: "#ffb6c1"
    },
    {
        id: "electric_blue",
        name: "Electric Blue",
        category: "bright",
        bgColor: "#0000ff",
        bubbleSent: "#ffffff",
        bubbleReceived: "#4169e1",
        textColor: "#ffffff",
        secondaryText: "#87ceeb",
        inputBg: "#1e90ff"
    },
    {
        id: "lime_pop",
        name: "Lime Green Pop",
        category: "bright",
        bgColor: "#32cd32",
        bubbleSent: "#000000",
        bubbleReceived: "#7cfc00",
        textColor: "#000000",
        secondaryText: "#228b22",
        inputBg: "#adff2f"
    },
    {
        id: "sunset_orange",
        name: "Sunset Orange",
        category: "bright",
        bgColor: "#ff4500",
        bubbleSent: "#ffffff",
        bubbleReceived: "#ff8c00",
        textColor: "#ffffff",
        secondaryText: "#ffa500",
        inputBg: "#ffd700"
    },
    {
        id: "rainbow_grad",
        name: "Rainbow Gradient",
        category: "bright",
        bgColor: "linear-gradient(45deg, #f06, #f90)",
        bubbleSent: "#ffffff",
        bubbleReceived: "rgba(255,255,255,0.2)",
        textColor: "#ffffff",
        secondaryText: "#ffffff",
        inputBg: "rgba(255,255,255,0.3)"
    },
    {
        id: "aqua_glow",
        name: "Aqua Glow",
        category: "bright",
        bgColor: "#00ffff",
        bubbleSent: "#000000",
        bubbleReceived: "#7fffd4",
        textColor: "#000000",
        secondaryText: "#008b8b",
        inputBg: "#e0ffff"
    },
    {
        id: "purple_neon_bright",
        name: "Purple Neon",
        category: "bright",
        bgColor: "#8a2be2",
        bubbleSent: "#ffffff",
        bubbleReceived: "#9370db",
        textColor: "#ffffff",
        secondaryText: "#e6e6fa",
        inputBg: "#9966cc"
    },
    {
        id: "fire_red",
        name: "Fire Red Bright",
        category: "bright",
        bgColor: "#ff0000",
        bubbleSent: "#ffffff",
        bubbleReceived: "#dc143c",
        textColor: "#ffffff",
        secondaryText: "#ffa07a",
        inputBg: "#ff4500"
    },
    {
        id: "yellow_flash",
        name: "Yellow Flash",
        category: "bright",
        bgColor: "#ffff00",
        bubbleSent: "#000000",
        bubbleReceived: "#ffd700",
        textColor: "#000000",
        secondaryText: "#8b8b00",
        inputBg: "#fffacd"
    },
    {
        id: "cyan_pulse",
        name: "Cyan Pulse",
        category: "bright",
        bgColor: "#00ced1",
        bubbleSent: "#ffffff",
        bubbleReceived: "#20b2aa",
        textColor: "#ffffff",
        secondaryText: "#e0ffff",
        inputBg: "#40e0d0"
    },
    // SOLID THEMES (5)
    {
        id: "solid_black",
        name: "Pure Black",
        category: "solid",
        bgColor: "#000000",
        bubbleSent: "#25d366",
        bubbleReceived: "#262626",
        textColor: "#ffffff",
        secondaryText: "#a0a0a0",
        inputBg: "#121212"
    },
    {
        id: "clean_white",
        name: "Clean White",
        category: "solid",
        bgColor: "#ffffff",
        bubbleSent: "#00a884",
        bubbleReceived: "#f0f2f5",
        textColor: "#111b21",
        secondaryText: "#667781",
        inputBg: "#f0f2f5"
    },
    {
        id: "navy_blue",
        name: "Navy Blue",
        category: "solid",
        bgColor: "#000080",
        bubbleSent: "#ffffff",
        bubbleReceived: "#00004d",
        textColor: "#ffffff",
        secondaryText: "#b0c4de",
        inputBg: "#000066"
    },
    {
        id: "forest_green_solid",
        name: "Forest Green",
        category: "solid",
        bgColor: "#228b22",
        bubbleSent: "#ffffff",
        bubbleReceived: "#1b5e20",
        textColor: "#ffffff",
        secondaryText: "#c8e6c9",
        inputBg: "#2e7d32"
    },
    {
        id: "deep_maroon",
        name: "Deep Maroon",
        category: "solid",
        bgColor: "#800000",
        bubbleSent: "#ffffff",
        bubbleReceived: "#4d0000",
        textColor: "#ffffff",
        secondaryText: "#ffcccb",
        inputBg: "#660000"
    },
    // NATURE & WEATHER THEMES (10)
    {
        id: "rainy_mood",
        name: "Rainy Mood",
        category: "nature",
        bgColor: "#4b5d67",
        pattern: "/patterns/rain.png",
        bubbleSent: "#322f3d",
        bubbleReceived: "#59405c",
        textColor: "#ffffff",
        secondaryText: "#bdc3c7",
        inputBg: "#322f3d"
    },
    {
        id: "sunny_day",
        name: "Sunny Day",
        category: "nature",
        bgColor: "#87ceeb",
        bubbleSent: "#ffd700",
        bubbleReceived: "#ffffff",
        textColor: "#2c3e50",
        secondaryText: "#34495e",
        inputBg: "#ffffff"
    },
    {
        id: "forest_leaf",
        name: "Forest Leaf",
        category: "nature",
        bgColor: "#2d5a27",
        bubbleSent: "#4a7023",
        bubbleReceived: "#1c3311",
        textColor: "#f0f0f0",
        secondaryText: "#a8c69f",
        inputBg: "#2d5a27"
    },
    {
        id: "ocean_breeze",
        name: "Ocean Breeze",
        category: "nature",
        bgColor: "#0077be",
        bubbleSent: "#00a8cc",
        bubbleReceived: "#00334e",
        textColor: "#ffffff",
        secondaryText: "#b0e0e6",
        inputBg: "#005b8e"
    },
    {
        id: "sunset_sky",
        name: "Sunset Sky",
        category: "nature",
        bgColor: "linear-gradient(to bottom, #fd5e53, #ffb347)",
        bubbleSent: "#ffffff",
        bubbleReceived: "rgba(0,0,0,0.2)",
        textColor: "#ffffff",
        secondaryText: "#ffe4e1",
        inputBg: "rgba(255,255,255,0.2)"
    },
    {
        id: "night_sky",
        name: "Night Sky",
        category: "nature",
        bgColor: "#0f1626",
        pattern: "/patterns/stars.png",
        bubbleSent: "#ab987a",
        bubbleReceived: "#1b2a41",
        textColor: "#ffffff",
        secondaryText: "#8696a0",
        inputBg: "#162238"
    },
    {
        id: "cloudy_grey",
        name: "Cloudy Grey",
        category: "nature",
        bgColor: "#bdc3c7",
        bubbleSent: "#7f8c8d",
        bubbleReceived: "#ecf0f1",
        textColor: "#2c3e50",
        secondaryText: "#95a5a6",
        inputBg: "#ffffff"
    },
    {
        id: "desert_sand",
        name: "Desert Sand",
        category: "nature",
        bgColor: "#edc9af",
        bubbleSent: "#c2b280",
        bubbleReceived: "#f4a460",
        textColor: "#3d2b1f",
        secondaryText: "#5c4033",
        inputBg: "#ffffff"
    },
    {
        id: "aurora_lights",
        name: "Aurora Lights",
        category: "nature",
        bgColor: "linear-gradient(to top, #01161e, #124559, #598392)",
        bubbleSent: "#aec3b0",
        bubbleReceived: "rgba(255,255,255,0.1)",
        textColor: "#ffffff",
        secondaryText: "#eff6e0",
        inputBg: "rgba(0,0,0,0.3)"
    },
    {
        id: "storm_mode",
        name: "Storm Mode",
        category: "nature",
        bgColor: "#1c1c1c",
        bubbleSent: "#5d5d5d",
        bubbleReceived: "#333333",
        textColor: "#ffffff",
        secondaryText: "#8696a0",
        inputBg: "#252525"
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = chatThemes;
} else {
    window.chatThemes = chatThemes;
}
