/**
 * Groups Mock Data - Sparkle Standard
 * Used for frontend-only prototyping and UX testing
 */

const MockData = {
    currentUser: {
        id: 101,
        name: "Sparkle Dev",
        username: "sparkle_dev",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sparkle"
    },
    
    groups: [
        {
            id: 1,
            name: "BIT 110 - Computing",
            members: 1250,
            category: "Campus",
            description: "Official group for BIT 110 students. Share resources, ask questions, and collaborate on projects.",
            icon: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=100&h=100&fit=crop",
            cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=300&fit=crop",
            isMember: true,
            role: "admin",
            privacy: "public",
            about: "This is the primary hub for all computing students in the BIT 110 course.",
            rules: [
                "Be respectful to all members and faculty.",
                "No plagiarism in shared assignments.",
                "Keep discussions relevant to computing."
            ]
        },
        {
            id: 2,
            name: "Study Buddies UoN",
            members: 342,
            category: "Study",
            description: "Find your perfect study partner for the semester! All majors welcome.",
            icon: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=100&h=100&fit=crop",
            cover: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=300&fit=crop",
            isMember: false,
            status: "none", // none, pending, active
            role: "member",
            privacy: "public"
        },
        {
            id: 3,
            name: "Sparkle Sports Club",
            members: 89,
            category: "Sports",
            description: "Weekly football, basketball, and tennis meetups. Stay fit, stay Sparkle!",
            icon: "https://images.unsplash.com/photo-1517466787929-bc9a732a396b?w=100&h=100&fit=crop",
            cover: "https://images.unsplash.com/photo-1517466787929-bc9a732a396b?w=800&h=300&fit=crop",
            isMember: false,
            status: "pending",
            role: "member",
            privacy: "private"
        }
    ],
    
    posts: [
        {
            id: 1,
            groupId: 1,
            user: "Alice Smith",
            username: "alice_codes",
            avatar: "https://i.pravatar.cc/150?u=alice",
            content: "Has anyone finished the assignment on Binary Search Trees? I'm stuck on the rotation logic. 🌲💻",
            image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=600&h=400&fit=crop",
            time: "2 hours ago",
            likes: 12,
            comments: [
                { user: "Bob", content: "Check out the GeeksForGeeks visualization, it helped me a lot!", time: "1 hour ago" }
            ]
        },
        {
            id: 2,
            groupId: 1,
            user: "Charlie Brown",
            username: "charlie_b",
            avatar: "https://i.pravatar.cc/150?u=charlie",
            content: "Reminder: The guest lecture is tomorrow at 10 AM in Hall B. Don't be late!",
            time: "5 hours ago",
            likes: 45,
            comments: []
        }
    ],
    
    requests: [
        { id: 1, groupId: 1, userId: 201, name: "David Johnson", username: "david_j", avatar: "https://i.pravatar.cc/150?u=david" },
        { id: 2, groupId: 1, userId: 202, name: "Eve Online", username: "eve_o", avatar: "https://i.pravatar.cc/150?u=eve" }
    ]
};

if (typeof window !== 'undefined') {
    window.MockData = MockData;
}
