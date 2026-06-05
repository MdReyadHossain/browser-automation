const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fillUpJobForm = async (fields, userInfo) => {
    try {
        const prompt = `
            You are an expert at filling out job application forms.
            You will be given a list of form fields and a candidate's information.
            Your job is to map the correct value to each field.

            FORM FIELDS:
            ${JSON.stringify(fields.map(f => ({
            index: f.index,
            label: f.label,
            placeholder: f.placeholder,
            type: f.type,
            name: f.name,
            required: f.required,
            options: f.options,  // dropdown এর জন্য
        })), null, 2)}

            CANDIDATE INFORMATION:
            ${JSON.stringify(userInfo, null, 2)}

            INSTRUCTIONS:
            - Every field must have an action
            - For fields where user data is not available, use "skip"
            - For required fields where data is missing, make a reasonable guess
            - For dropdowns, value must exactly match one of the provided options
            - For checkboxes like "I agree to terms", action is "check"
            - For file upload fields, action is "upload"
            - Do not include any explanation, only return the JSON array

            RETURN FORMAT (strict JSON array, nothing else): For example:
            [
                {
                    "index": 0,
                    "label": "First Name",
                    "action": "fill",
                    "value": "<user name>",
                    "reason": "matched firstName from user info"
                },
                {
                    "index": 1,
                    "label": "Country",
                    "action": "select",
                    "value": "<country from dropdown options>",
                    "reason": "matched country from user info"
                },
                {
                    "index": 2,
                    "label": "Resume",
                    "action": "upload",
                    "value": "<user resume file url or path>",
                    "reason": "file upload field"
                },
                {
                    "index": 3,
                    "label": "I agree to terms",
                    "action": "check",
                    "value": true,
                    "reason": "terms agreement checkbox"
                },
                {
                    "index": 4,
                    "label": "LinkedIn (optional)",
                    "action": "skip",
                    "value": "<user linkedin url if available, otherwise null>",
                    "reason": "no linkedin in user info"
                },
                ...for other questions fields, provide similar objects with valid actions and values based on the user info and field requirements
            ]
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const raw = response.choices[0].message.content.trim();

        const parsed = JSON.parse(raw);

        const actions = Array.isArray(parsed) ? parsed : parsed.actions || parsed.fields || [];

        console.log('\n========== AI FORM FILL PLAN ==========');
        actions.forEach(a => {
            console.log(`[${a.action.toUpperCase()}] ${a.label} → "${a.value}" (${a.reason})`);
        });

        return actions;

    } catch (error) {
        console.error("Error in fillUpJobForm:", error);
        throw new Error("Failed to generate form fill plan");
    }
};

module.exports = {
    fillUpJobForm,
};