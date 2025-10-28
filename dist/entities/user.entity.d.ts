export declare enum UserRole {
    USER = "user",
    CREATOR = "creator",
    ADMIN = "admin"
}
export declare class User {
    id: string;
    email: string;
    name: string;
    password: string;
    role: UserRole;
    walletBalance: number;
    googleId: string;
    youtubeChannelId: string;
    youtubeAccessToken: string;
    youtubeRefreshToken: string;
    youtubeTokenExpiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    hashPassword(): Promise<void>;
}
