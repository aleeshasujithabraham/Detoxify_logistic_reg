import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score


df = pd.read_csv(r"C:\Users\hp\Downloads\sexism_data.csv")

X = df["text"]         
y = df["sexist"]         

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)


vectorizer = TfidfVectorizer(
    max_features=5000,
    ngram_range=(1,2),
    stop_words="english"
)

X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)


model = LogisticRegression(max_iter=1000)
model.fit(X_train_vec, y_train)


y_pred = model.predict(X_test_vec)


print("Accuracy:", accuracy_score(y_test, y_pred))
print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))

# Save model and vectorizer for Flask backend
import joblib
joblib.dump(model, "logreg_model.joblib")
joblib.dump(vectorizer, "vectorizer.joblib")
