import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../utils/api";

interface AuthState {
    user: any | null;
    token: string | null;
    loading: boolean;
    error: string | null;
}

const initialState: AuthState = {
    user: null,
    token: null,
    loading: false,
    error: null,
};

export const loginUser = createAsyncThunk(
    "auth/login",
    async (data: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const res = await api.post("/auth/login", data);
            return res.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Login failed");
        }
    }
);

export const registerUser = createAsyncThunk(
    "auth/register",
    async (data: { name: string; email: string; password: string }, { rejectWithValue }) => {
        try {
            const res = await api.post("/auth/register", data);
            return res.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Registration failed");
        }
    }
);

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => { state.loading = true; })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
            });
    },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
