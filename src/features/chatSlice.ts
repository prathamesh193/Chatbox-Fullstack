import { createSlice } from "@reduxjs/toolkit";

interface ChatState {
    messages: any[];
    selectedChat: string | null;
}

const initialState: ChatState = {
    messages: [],
    selectedChat: null,
};

const chatSlice = createSlice({
    name: "chat",
    initialState,
    reducers: {
        setMessages: (state, action) => {
            state.messages = action.payload;
        },
        addMessage: (state, action) => {
            state.messages.push(action.payload);
        },
        setSelectedChat: (state, action) => {
            state.selectedChat = action.payload;
        },
    },
});

export const { setMessages, addMessage, setSelectedChat } = chatSlice.actions;
export default chatSlice.reducer;
